import type { CaseScene } from './case-scenes';
import { advancePosition, type MotionPosition } from './case-motion.ts';

export interface CaseAppAdapter {
  enter(scene: CaseScene, signal: AbortSignal, draw: () => void): Promise<void>;
}

export function scrollDestination(position: number, viewport: number, content: number): number {
  return Math.max(0, Math.min(position, content - viewport));
}

export function createCaseAdapter(resetDay: () => void, syncScroll: (top: number) => void = () => {}): CaseAppAdapter {
  const after = document.querySelector<HTMLElement>('.main-scroll')!;
  const before = document.querySelector<HTMLElement>('.before-scroll')!;
  const stage = document.querySelector<HTMLElement>('.comparison-stage')!;
  const nodes = [before, after];
  const contents = nodes.map(node => node.firstElementChild as HTMLElement);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let positions: MotionPosition[] = [];
  let maximums = [0, 0];
  let ends = [0, 0];
  let active = false;
  let frame = 0;
  let lastTime = 0;
  let pending: { resolve: () => void; cleanup: () => void; draw: () => void } | undefined;

  function finish(): void {
    cancelAnimationFrame(frame); frame = 0;
    if (!active) return;
    active = false;
    // Commit the same visual position once, then return native scrolling to
    // the interactive app. The live DOM is never replaced by a screenshot.
    nodes.forEach((node, i) => {
      node.style.overflow = '';
      contents[i].style.transform = '';
      node.scrollTo({ top: positions[i].position, behavior: 'instant' });
    });
    stage.dataset.screenMoving = 'false';
    syncScroll(after.scrollTop);
  }

  function tick(now: number): void {
    frame = 0;
    const elapsed = lastTime ? now - lastTime : 16;
    lastTime = now;
    positions = positions.map((state, i) => {
      const next = reduced.matches ? { position: ends[i], velocity: 0 } : advancePosition(state, ends[i], elapsed);
      const bounded = Math.max(0, Math.min(maximums[i], next.position));
      return bounded === next.position ? next : { position: bounded, velocity: 0 };
    });
    // One compositor translation per phone, rather than native scroll writes
    // and scroll events on every frame. Fractional pixels remain continuous.
    contents.forEach((content, i) => { content.style.transform = `translate3d(0,${-positions[i].position}px,0)`; });
    syncScroll(positions[1].position);
    if (positions.some((state, i) => state.position !== ends[i] || state.velocity !== 0)) {
      frame = requestAnimationFrame(tick);
    } else {
      finish();
      const completed = pending; pending = undefined;
      completed?.cleanup(); completed?.draw(); completed?.resolve();
    }
  }

  return {
    enter(scene, signal, draw) {
      signal.throwIfAborted();
      resetDay();
      if (!active) positions = nodes.map(node => ({ position: node.scrollTop, velocity: 0 }));
      const target = document.querySelector<HTMLElement>(`[data-case-anchor="${scene.afterScroll}"]`);
      const viewport = after.getBoundingClientRect();
      const scale = viewport.width / after.clientWidth;
      const anchorTop = target ? positions[1].position + (target.getBoundingClientRect().top - viewport.top) / scale - 100 : 0;
      const destination = scene.afterScroll === 'bottom' ? contents[1].offsetHeight : scene.afterScroll === 'top' ? 0 : anchorTop;
      maximums = contents.map((content, i) => Math.max(0, content.offsetHeight - nodes[i].clientHeight));
      ends = [scene.beforeScroll, destination].map((value, i) => scrollDestination(value, nodes[i].clientHeight, contents[i].offsetHeight));
      if (!active && ends.every((end, i) => Math.abs(end - positions[i].position) < .5)) { draw(); return Promise.resolve(); }

      return new Promise<void>((resolve, reject) => {
        const cleanup = () => signal.removeEventListener('abort', cancel);
        const cancel = () => {
          cleanup(); pending = undefined; reject(signal.reason);
          // A new scene arrives in this same turn: keep the clock and velocity.
          // Free mode/disposal without a replacement restores native scrolling.
          queueMicrotask(() => { if (!pending) finish(); });
        };
        signal.addEventListener('abort', cancel, { once: true });
        pending = { resolve, cleanup, draw };
        if (!active) {
          active = true; lastTime = 0;
          stage.dataset.screenMoving = 'true';
          nodes.forEach((node, i) => {
            node.style.overflow = 'clip';
            contents[i].style.transform = `translate3d(0,${-positions[i].position}px,0)`;
          });
        }
        if (!frame) frame = requestAnimationFrame(tick);
      });
    },
  };
}
