import { spring } from 'motion';

export interface ViewRect { x: number; y: number; width: number; height: number }

/** Motion's critically damped spring, sampled once for compositor animation.
 * https://motion.dev/docs/spring — duration is milliseconds for this API.
 */
export function springProgress(duration: number): { offset: number; progress: number }[] {
  const generator = spring({ keyframes: [0, 1], duration, bounce: 0 });
  const count = Math.ceil(duration / 8);
  return Array.from({ length: count + 1 }, (_, i) => ({
    offset: i / count,
    progress: i === count ? 1 : generator.next(duration * i / count).value,
  }));
}

export function blendRect(from: ViewRect, to: ViewRect, progress: number): ViewRect {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
    width: from.width + (to.width - from.width) * progress,
    height: from.height + (to.height - from.height) * progress,
  };
}

/** Map the live destination box back onto its previous screen position. */
export function rectTransform(from: ViewRect, to: ViewRect): string {
  return `translate3d(${from.x - to.x}px,${from.y - to.y}px,0) scale(${from.width / to.width},${from.height / to.height})`;
}
