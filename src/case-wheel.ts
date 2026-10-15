import { advancePosition, type MotionPosition } from './case-motion.ts';

/** Wheel delta units differ between a mouse, trackpad and page-mode devices. */
export function wheelPixels(delta: number, mode: number, viewport: number): number {
  return delta * (mode === 1 ? 16 : mode === 2 ? viewport : 1);
}

/** One continuous page trajectory, shared by a whole wheel gesture. */
export class CaseWheelMotion {
  private state: MotionPosition;
  private direction = 0;
  private maximum = 0;
  target: number;

  constructor(position: number) {
    this.state = { position, velocity: 0 };
    this.target = position;
  }

  push(delta: number, maximum: number): void {
    this.maximum = maximum;
    const direction = Math.sign(delta);
    // Reversing the wheel discards untravelled distance, without teleporting
    // or restarting the current movement at each individual wheel event.
    if (direction !== this.direction) this.target = this.state.position;
    this.direction = direction;
    this.target = Math.max(0, Math.min(maximum, this.target + delta));
  }

  step(elapsed: number, immediate = false): number {
    this.state = immediate ? { position: this.target, velocity: 0 } : advancePosition(this.state, this.target, elapsed, 22);
    const bounded = Math.max(0, Math.min(this.maximum, this.state.position));
    if (bounded !== this.state.position) this.state = { position: bounded, velocity: 0 };
    return this.state.position;
  }

  get settled(): boolean { return this.state.position === this.target && this.state.velocity === 0; }
}
