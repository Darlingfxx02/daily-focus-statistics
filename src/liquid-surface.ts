export interface IconBounds { top: number; bottom: number }
const svgNS = 'http://www.w3.org/2000/svg';

/** Measure visible artwork, so transparent PNG margins don't count toward progress. */
export function readIconBounds(image: HTMLImageElement): IconBounds {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let top = canvas.height;
  let bottom = 0;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 3] > 16) {
        top = Math.min(top, y);
        bottom = Math.max(bottom, y + 1);
        break;
      }
    }
  }
  return bottom > top ? { top: top / canvas.height, bottom: bottom / canvas.height } : { top: 0, bottom: 1 };
}

interface WaveClip { slot: number; icon: string; back: boolean; path: SVGPathElement }

/** Clips the original colored PNG over its pale copy, retaining the PNG's alpha. */
export class LiquidSurface {
  readonly element = document.createElementNS(svgNS, 'svg');
  private clips: WaveClip[] = [];
  private bounds = new Map<string, IconBounds>();
  private iconSize = 88;

  constructor(symbols: readonly string[], slots = 3, prefix = 'focus-wave') {
    this.element.classList.add('liquid-masks');
    this.element.setAttribute('width', '0');
    this.element.setAttribute('height', '0');
    this.element.setAttribute('aria-hidden', 'true');
    this.element.setAttribute('focusable', 'false');
    const defs = document.createElementNS(svgNS, 'defs');
    this.element.append(defs);
    for (let slot = 0; slot < slots; slot++) {
      for (const icon of symbols) {
        for (const back of [true, false]) {
          const clip = document.createElementNS(svgNS, 'clipPath');
          clip.id = `${prefix}-${slot}-${icon}-${back ? 'back' : 'front'}`;
          clip.setAttribute('clipPathUnits', 'objectBoundingBox');
          const path = document.createElementNS(svgNS, 'path');
          path.setAttribute('d', 'M0 0Z');
          clip.append(path);
          defs.append(clip);
          this.clips.push({ slot, icon, back, path });
        }
      }
    }
  }

  configure(bounds: ReadonlyMap<string, IconBounds>): void { this.bounds = new Map(bounds); }
  resize(iconSize: number): void { this.iconSize = Math.max(1, iconSize); }

  draw(levels: readonly number[], time: number, moving: boolean): void {
    // Keep the small wave still while the presentation moves a whole screen:
    // changing clip paths would invalidate its compositor texture every frame.
    if (moving && levels.some(level => level > 0 && level < 1) && this.element.closest('[data-screen-moving="true"]')) return;
    for (const clip of this.clips) {
      const level = levels[clip.slot];
      if (level <= 0 || level >= 1) {
        clip.path.setAttribute('d', level <= 0 ? 'M0 0Z' : 'M0 0H1V1H0Z');
        continue;
      }
      const bounds = this.bounds.get(clip.icon) ?? { top: .08, bottom: .92 };
      const edge = Math.min(1, level / .06, (1 - level) / .06);
      const amplitude = moving ? 2.2 / this.iconSize * edge : 0;
      const phase = time * .95 + clip.slot * 2.1 + (clip.back ? 1.8 : 0);
      const base = bounds.bottom - level * (bounds.bottom - bounds.top) - (clip.back ? amplitude * .45 : 0);
      const frequency = Math.PI * 2;
      const value = (x: number): number => base + amplitude * (Math.sin(x * frequency + phase) + .28 * Math.sin(x * frequency * 1.7 - phase * .7));
      const slope = (x: number): number => amplitude * frequency * (Math.cos(x * frequency + phase) + .28 * 1.7 * Math.cos(x * frequency * 1.7 - phase * .7));
      const n = (v: number): string => v.toFixed(5);
      let path = `M0 1L0 ${n(value(0))}`;
      // Cubic Hermite segments keep the small waves smooth at any display density.
      for (let step = 0; step < 8; step++) {
        const x0 = step / 8;
        const x1 = (step + 1) / 8;
        const dx = (x1 - x0) / 3;
        path += `C${n(x0 + dx)} ${n(value(x0) + slope(x0) * dx)} ${n(x1 - dx)} ${n(value(x1) - slope(x1) * dx)} ${n(x1)} ${n(value(x1))}`;
      }
      clip.path.setAttribute('d', `${path}L1 1Z`);
    }
  }
}
