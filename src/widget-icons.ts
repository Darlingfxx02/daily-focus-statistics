import { LiquidSurface, readIconBounds } from './liquid-surface';

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

export function widgetIllustration(metric: 'water' | 'weight', level: number, description: string): string {
  const url = `${import.meta.env.BASE_URL}assets/focus-3d/${metric}-${metric === 'weight' ? 'v2' : 'v1'}.png`;
  const img = `<img src="${url}" alt="" draggable="false" />`;
  return `<div class="${metric}-illustration widget-illustration" data-widget-metric="${metric}" data-widget-level="${clamp(level)}" role="img" aria-label="${description}">
    <span class="liquid-icon-pale">${img}</span>
    <span class="liquid-icon-color liquid-icon-back" style="clip-path:url(#widget-${metric}-wave-0-${metric}-back)">${img}</span>
    <span class="liquid-icon-color" style="clip-path:url(#widget-${metric}-wave-0-${metric}-front)">${img}</span>
  </div>`;
}

/** Same PNG and wave renderer as the daily focus, with independent progress. */
export function animateWidgetIcon(root: HTMLElement, scrollRoot: HTMLElement, previous?: number): () => void {
  const metric = root.dataset.widgetMetric!;
  const renderer = new LiquidSurface([metric], 1, `widget-${metric}-wave`);
  root.append(renderer.element);
  const target = Number(root.dataset.widgetLevel);
  const from = previous ?? 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let level = from;
  let start: number | undefined;
  let raf = 0;
  let lastDraw = 0;
  let ready = false;
  let visible = false;
  let stopped = false;
  let settled = false;
  const draw = (time: number): void => {
    root.dataset.currentLevel = String(level);
    root.dataset.complete = String(level >= 1);
    renderer.draw([level], reduced.matches ? 0 : time / 1000, !reduced.matches);
  };
  const tick = (time: number): void => {
    raf = 0;
    if (stopped || !ready || !visible || document.hidden) return;
    start ??= time;
    const t = reduced.matches ? 1 : clamp((time - start) / 1050);
    level = from + (target - from) * (1 - Math.pow(1 - t, 4));
    if (t < 1 || !settled || time - lastDraw >= 32 || reduced.matches) { draw(time); lastDraw = time; }
    settled = t === 1;
    if (!reduced.matches && (t < 1 || (level > 0 && level < 1))) raf = requestAnimationFrame(tick);
  };
  const resume = (): void => { if (!raf && ready && visible && !stopped && !document.hidden) raf = requestAnimationFrame(tick); };
  const onMotion = (): void => {
    if (reduced.matches) { cancelAnimationFrame(raf); raf = 0; start = -Infinity; level = target; draw(0); }
    else resume();
  };
  const onVisibility = (): void => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else resume();
  };
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) resume(); else { cancelAnimationFrame(raf); raf = 0; }
  }, { root: scrollRoot.closest('.phone') ?? scrollRoot, rootMargin: '0px 0px -104px 0px' });
  observer.observe(root.closest('.stat-card')!);
  const resize = new ResizeObserver(() => { renderer.resize(root.getBoundingClientRect().width); draw(performance.now()); });
  resize.observe(root);
  reduced.addEventListener('change', onMotion);
  document.addEventListener('visibilitychange', onVisibility);
  if (reduced.matches) { level = target; start = -Infinity; }
  draw(0);
  const image = root.querySelector<HTMLImageElement>('img')!;
  void image.decode().then(() => {
    if (!stopped) renderer.configure(new Map([[metric, readIconBounds(image)]]));
  }).catch(() => {}).then(() => {
    if (stopped) return;
    ready = true;
    if (reduced.matches) draw(0); else resume();
  });
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    observer.disconnect();
    resize.disconnect();
    reduced.removeEventListener('change', onMotion);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
