const barSelector = '.macro-bar > span, .progress-track > span';
const easing = 'cubic-bezier(.22,1,.36,1)';

interface CardFrame { bars: number[] }
export type StatsFrame = Map<string, CardFrame>;

function widthPercent(bar: HTMLElement): number {
  const trackWidth = bar.parentElement!.getBoundingClientRect().width;
  return trackWidth ? bar.getBoundingClientRect().width / trackWidth * 100 : 0;
}

export function captureStats(root: HTMLElement): StatsFrame {
  return new Map([...root.querySelectorAll<HTMLElement>('.stat-card')].map(card => [card.id, {
    bars: [...card.querySelectorAll<HTMLElement>(barSelector)].map(widthPercent),
  }]));
}

/** Animate changed values when their indicator is visible, not behind the fold. */
export function animateStatsChange(root: HTMLElement, scrollRoot: HTMLElement, previous?: StatsFrame): () => void {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reducedMotion.matches) return () => {};
  const animations = new Set<Animation>();
  const restorations: Array<() => void> = [];
  const pending = new Map<Element, () => void>();
  let stopped = false;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const start = pending.get(entry.target);
      pending.delete(entry.target);
      observer.unobserve(entry.target);
      start?.();
    });
    settle();
  }, { root: scrollRoot.closest('.phone') ?? scrollRoot, rootMargin: '0px 0px -20px 0px', threshold: .25 });

  function finish(): void {
    if (stopped) return;
    stopped = true;
    observer.disconnect();
    pending.clear();
    restorations.forEach(restore => restore());
    animations.forEach(animation => animation.cancel());
    animations.clear();
    reducedMotion.removeEventListener('change', onMotionChange);
  }
  function settle(): void { if (!pending.size && !animations.size) finish(); }
  function onMotionChange(): void { if (reducedMotion.matches) finish(); }
  function play(element: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions): void {
    const animation = element.animate(frames, options);
    animations.add(animation);
    void animation.finished.then(() => {
      animations.delete(animation);
      animation.cancel();
      settle();
    }, () => {});
  }
  reducedMotion.addEventListener('change', onMotionChange);

  root.querySelectorAll<HTMLElement>('.stat-card').forEach(card => {
    const old = previous?.get(card.id);
    const jobs: Array<() => void> = [];
    card.querySelectorAll<HTMLElement>(barSelector).forEach((bar, index) => {
      const to = parseFloat(bar.style.width);
      const from = old?.bars[index] ?? 0;
      if (Math.abs(to - from) < .05) return;
      const restore = () => { bar.style.width = `${to}%`; };
      restorations.push(restore);
      bar.style.width = `${from}%`;
      jobs.push(() => {
        restore();
        play(bar, [{ width: `${from}%` }, { width: `${to}%` }], { duration: 620, delay: index * 45, easing, fill: 'both' });
      });
    });

    if (jobs.length) {
      const watch = card.querySelector('.macro-bar, .progress-track') ?? card.querySelector('.main-value') ?? card;
      pending.set(watch, () => { if (!stopped) jobs.forEach(start => start()); });
      observer.observe(watch);
    }
  });
  settle();
  return finish;
}
