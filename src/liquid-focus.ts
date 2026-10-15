import { focusLabels, targets, waterInMl, type DayData, type DailyFocuses, type Focus } from './data';
import { LiquidSurface, readIconBounds, type IconBounds } from './liquid-surface';

const symbols: readonly Focus[] = ['food', 'activity', 'water', 'steps', 'sleep'];
const iconUrl = (focus: Focus): string => `${import.meta.env.BASE_URL}assets/focus-3d/${focus}-v1.png`;
const cell = (focus: Focus, slot: number): string => {
  const img = `<img src="${iconUrl(focus)}" data-icon="${focus}" alt="" draggable="false" />`;
  return `<span class="liquid-icon-cell"><span class="liquid-icon-pale">${img}</span><span class="liquid-icon-color liquid-icon-back" style="clip-path:url(#focus-wave-${slot}-${focus}-back)">${img}</span><span class="liquid-icon-color" style="clip-path:url(#focus-wave-${slot}-${focus}-front)">${img}</span></span>`;
};
const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const ease = (t: number): number => 1 - Math.pow(1 - clamp(t), 4);

interface TileFrame { focus: Focus; icon: Focus; level: number }
export type LiquidFrame = TileFrame[];
const frames = new WeakMap<HTMLElement, LiquidFrame>();
let surface: LiquidSurface | undefined;
let preload: Promise<Map<string, IconBounds>> | undefined;

const metricValue = (value: number, focus: Focus): string => focus === 'sleep' ? `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}` : String(focus === 'water' ? waterInMl(value) : value).replace('.', ',');
const metricUnits: Record<Focus, string> = { food: 'ккал', activity: 'ккал', water: 'мл', steps: 'шагов', sleep: 'ч : мин' };
const spokenValue = (value: number, focus: Focus): string => focus === 'sleep' ? `${Math.floor(value / 60)} ч ${value % 60} мин` : `${metricValue(value, focus)} ${metricUnits[focus]}`;

export function liquidFocusTiles(focuses: DailyFocuses, progress: readonly number[], description: string, data: DayData): string {
  return `<div class="liquid-focus" role="group" aria-label="${description}" data-node-id="156:5560">${focuses.map((focus, i) =>
    `<div class="liquid-tile" role="progressbar" aria-label="${focusLabels[focus]}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress[i] * 100)}" aria-valuetext="${Math.round(progress[i] * 100)}%. ${spokenValue(data[focus], focus)} из ${spokenValue(targets[focus], focus)}" data-focus="${focus}" data-target="${progress[i]}">
      <div class="liquid-icon-window" aria-hidden="true"><div class="liquid-icon-strip">${cell(focus, i)}</div></div>
      <p class="liquid-values" aria-hidden="true"><strong>${metricValue(data[focus], focus)}</strong><span>/ ${metricValue(targets[focus], focus)}</span></p>
      <p class="liquid-unit" aria-hidden="true">${metricUnits[focus]}</p>
    </div>`).join('')}</div>`;
}

/** Preserve the visible level and reel symbol when a transition is interrupted. */
export function captureLiquidFocus(root: HTMLElement): LiquidFrame | undefined {
  const current = frames.get(root);
  if (!current) return undefined;
  const strips = [...root.querySelectorAll<HTMLElement>('.liquid-icon-strip')];
  return current.map((tile, index) => {
    const strip = strips[index];
    const transform = getComputedStyle(strip).transform;
    const y = transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42;
    const size = (strip.firstElementChild as HTMLElement).offsetHeight;
    const visible = strip.children[Math.min(strip.children.length - 1, Math.max(0, Math.round(-y / size)))];
    return { ...tile, icon: visible.querySelector<HTMLImageElement>('img')!.dataset.icon as Focus };
  });
}

export function animateLiquidFocus(root: HTMLElement, scrollArea: HTMLElement, previous?: LiquidFrame): () => void {
  surface ??= new LiquidSurface(symbols);
  const renderer = surface;
  root.append(renderer.element);
  root.dataset.renderer = 'image-mask';
  const tiles = [...root.querySelectorAll<HTMLElement>('.liquid-tile')];
  const strips = [...root.querySelectorAll<HTMLElement>('.liquid-icon-strip')];
  const next: LiquidFrame = tiles.map(tile => ({ focus: tile.dataset.focus as Focus, icon: tile.dataset.focus as Focus, level: Number(tile.dataset.target) }));
  const current = next.map((tile, index) => ({ ...tile, level: previous?.[index].level ?? 0 }));
  frames.set(root, current);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const animations: Animation[] = [];
  const changed = next.map((tile, i) => !previous || previous[i].icon !== tile.icon || Math.abs(previous[i].level - tile.level) > .001);
  let raf = 0;
  let stopped = false;
  let visible = true;
  let ready = false;
  let started = 0;
  let lastDraw = 0;
  let transitioning = true;
  const from = current.map(tile => ({ ...tile }));

  function draw(time: number): void {
    tiles.forEach((tile, i) => {
      tile.dataset.level = current[i].level.toFixed(4);
      tile.dataset.complete = String(current[i].level >= 1);
    });
    renderer.draw(current.map(tile => tile.level), reduced.matches ? 0 : time / 1000, !reduced.matches);
  }
  function settle(): void {
    transitioning = false;
    next.forEach((tile, i) => { Object.assign(current[i], tile); strips[i].innerHTML = cell(tile.icon, i); });
    animations.forEach(animation => animation.cancel());
    root.dataset.motion = 'complete';
    draw(performance.now());
  }
  function tick(time: number): void {
    raf = 0;
    if (stopped || !visible || document.hidden) return;
    if (ready && transitioning && !reduced.matches) {
      next.forEach((tile, i) => {
        const amount = ease((time - started - 100 - i * 60) / 1050);
        current[i].level = from[i].level + (tile.level - from[i].level) * amount;
      });
      if (time - started >= 1320) settle();
    }
    // 30fps is enough for the resting water; level transitions remain frame-smooth.
    if (transitioning || time - lastDraw >= 32) { draw(time); lastDraw = time; }
    if (!reduced.matches && (transitioning || current.some(tile => tile.level > 0 && tile.level < 1))) raf = requestAnimationFrame(tick);
  }
  function resume(): void { if (!raf && !stopped && visible && !document.hidden) raf = requestAnimationFrame(tick); }
  function onMotion(): void { if (reduced.matches) { cancelAnimationFrame(raf); raf = 0; settle(); } else resume(); }
  function onVisibility(): void { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else resume(); }
  reduced.addEventListener('change', onMotion);
  document.addEventListener('visibilitychange', onVisibility);
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) resume(); else { cancelAnimationFrame(raf); raf = 0; }
  }, { root: scrollArea.closest('.phone') ?? scrollArea });
  observer.observe(root);
  function syncGeometry(): void {
    renderer.resize(root.querySelector<HTMLElement>('.liquid-icon-window')!.getBoundingClientRect().width);
  }
  const resize = new ResizeObserver(() => { syncGeometry(); draw(performance.now()); });
  resize.observe(root);
  syncGeometry();
  root.dataset.motion = reduced.matches ? 'complete' : 'preparing';
  if (reduced.matches) settle(); else draw(0);

  preload ??= Promise.all(symbols.map(async focus => {
    const img = new Image();
    img.src = iconUrl(focus);
    let bounds: IconBounds = { top: .08, bottom: .92 };
    try { await img.decode(); bounds = readIconBounds(img); } catch { /* Preserve motion if an image cannot be decoded. */ }
    return [focus, bounds] as const;
  })).then(entries => new Map(entries));
  void preload.then(bounds => {
    if (stopped) return;
    renderer.configure(bounds);
    ready = true;
    started = performance.now();
    if (reduced.matches || !changed.some(Boolean)) { settle(); resume(); return; }
    root.dataset.motion = 'running';
    next.forEach((tile, i) => {
      if (!changed[i]) return;
      const first = previous?.[i].icon ?? tile.icon;
      const middle = symbols.filter(icon => icon !== first && icon !== tile.icon).slice(0, 2 + i % 2);
      const sequence = [first, ...middle, tile.icon];
      strips[i].innerHTML = sequence.map(icon => cell(icon, i)).join('');
      // Transforms use local CSS pixels, independent of the device's scale.
      const height = (strips[i].firstElementChild as HTMLElement).offsetHeight;
      animations.push(strips[i].animate([
        { transform: 'translateY(0)', filter: 'blur(0px)' },
        { filter: 'blur(1px)', offset: .25 },
        { transform: `translateY(-${(sequence.length - 1) * height}px)`, filter: 'blur(0px)' },
      ], { duration: 900, delay: i * 70, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' }));
    });
    resume();
  });
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    animations.forEach(animation => animation.cancel());
    resize.disconnect();
    observer.disconnect();
    reduced.removeEventListener('change', onMotion);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
