/** Only a gesture that starts at an edge may dismiss the prototype. */
export function edgePull(start: number, maximum: number, dx: number, dy: number): number {
  if (Math.abs(dy) <= Math.abs(dx) * 1.2) return 0;
  if (start <= 1 && dy > 0) return dy;
  if (start >= maximum - 1 && dy < 0) return dy;
  return 0;
}

export const dismissDistance = 120;
export const wheelDismissDistance = 220;
export const wheelReleaseDelay = 80;

/** Resistance increases continuously: a large input cannot throw the app away. */
export function elasticOffset(distance: number): number {
  return Math.sign(distance) * 160 * (1 - 1 / (1 + Math.abs(distance) * .65 / 160));
}

export class EdgePullGesture {
  distance = 0;
  private direction: number | undefined;
  private returning = false;
  private wheelPosition = 0;
  private start: number;
  private maximum: number;

  constructor(start: number, maximum: number) { this.start = start; this.maximum = maximum; }

  get claimed(): boolean { return Boolean(this.direction); }

  move(dx: number, dy: number): number {
    if (this.direction === undefined) {
      // Claim the first outward movement so native touch scrolling cannot
      // take ownership before our non-passive touchmove cancels it.
      if (!dx && !dy) return 0;
      // Decide once. Scrolling normally into an edge must never arm dismissal.
      this.direction = Math.sign(edgePull(this.start, this.maximum, dx, dy));
    }
    const distance = this.direction * Math.max(0, this.direction * dy) || 0;
    this.returning = Math.abs(distance) < Math.abs(this.distance);
    this.distance = distance;
    return distance;
  }

  push(delta: number): number {
    const previous = this.distance;
    this.wheelPosition += delta;
    const distance = this.move(0, this.wheelPosition);
    // After returning to rest, the remainder of this wheel gesture is native.
    if (previous && !distance) this.direction = 0;
    return distance;
  }

  canDismiss(threshold: number): boolean {
    return !this.returning && Math.abs(this.distance) >= threshold;
  }
}
