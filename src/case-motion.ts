/** Scroll-bound poses ease continuously; they never change device scale. */
export const clamp = (value: number): number => Math.max(0, Math.min(1, value));
export const smoothStep = (value: number): number => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

export function follow(current: number, target: number, elapsed: number): number {
  const value = current + (target - current) * (1 - Math.exp(-elapsed / 95));
  return Math.abs(value - target) < .0005 ? target : value;
}

export interface MotionPosition { position: number; velocity: number }

/** Critically damped motion: changing the target preserves position and velocity. */
export function advancePosition(state: MotionPosition, target: number, elapsed: number, frequency = 16): MotionPosition {
  const time = Math.min(40, Math.max(0, elapsed)) / 1000;
  const offset = state.position - target;
  const decay = Math.exp(-frequency * time);
  const impulse = state.velocity + frequency * offset;
  const position = target + (offset + impulse * time) * decay;
  const velocity = (state.velocity - frequency * impulse * time) * decay;
  return Math.abs(position - target) < .1 && Math.abs(velocity) < 1
    ? { position: target, velocity: 0 }
    : { position, velocity };
}
