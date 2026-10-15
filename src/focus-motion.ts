import { image, type Asset } from './assets';
import type { DailyFocuses, Focus } from './data';

const categories: Record<Focus, { icon: Asset; colors: readonly string[] }> = {
  food: { icon: 'focusFood', colors: ['#23865F', '#068769', '#018671'] },
  activity: { icon: 'focusActivity', colors: ['#D96227', '#DB5F3A', '#DC5C47'] },
  water: { icon: 'focusWater', colors: ['#2B6CFC', '#4966FC', '#5A61FB'] },
  steps: { icon: 'steps', colors: ['#0B8799', '#0B83A1', '#137FAA'] },
  sleep: { icon: 'sleep', colors: ['#7955C7', '#8352C3', '#8C50BE'] },
};
// The original Figma centerlines and spacing; each slot can now show any focus.
const lanes = [
  { radius: 64, spread: [200, 108], tip: 85 },
  { radius: 46, spread: [180, 78], tip: 62 },
  { radius: 28, spread: [145, 51], tip: 40 },
] as const;
const symbols = Object.values(categories).map(category => category.icon);
const cell = (asset: Asset): string => `<span class="focus-reel-cell">${image(asset)}</span>`;
const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const offset = (progress: number): string => String(progress > 0 ? 1 - progress : 1.03);
const fullPath = (r: number): string => `M163 ${72 - r} H254 A${r} ${r} 0 0 1 254 ${72 + r} H72 A${r} ${r} 0 0 1 72 ${72 - r} H163`;

export function focusArtwork(focuses: DailyFocuses, progress: readonly number[]): string {
  return focuses.map((focus, index) => {
    const lane = lanes[index];
    const path = fullPath(lane.radius);
    const measure = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    measure.setAttribute('d', path);
    const tip = measure.getPointAtLength(measure.getTotalLength() * progress[index]);
    const colors = categories[focus].colors;
    return `<svg class="focus-lane" data-focus="${focus}" data-slot="${index}" viewBox="0 0 326 144" aria-hidden="true"><defs>
      <mask id="focus-shape-${index}" maskUnits="userSpaceOnUse" x="0" y="0" width="326" height="144" style="mask-type:alpha"><path data-focus-mask d="${path}" pathLength="1" fill="none" stroke="white" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1 2" stroke-dashoffset="${offset(progress[index])}" /></mask>
      <radialGradient id="focus-tone-${index}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(163 ${72 - lane.radius}) scale(${lane.spread.join(' ')})">${colors.map((color, i) => `<stop data-tone-stop offset="${[0, .55, 1][i]}" stop-color="${color}" />`).join('')}</radialGradient>
      <radialGradient id="focus-tip-${index}" gradientUnits="userSpaceOnUse" cx="${tip.x}" cy="${tip.y}" r="${lane.tip}">${[0, .3, 1].map((position, i) => `<stop data-tip-stop offset="${position}" stop-color="${colors[2]}" stop-opacity="${i === 2 ? 0 : 1}" />`).join('')}</radialGradient>
    </defs><path data-track-tone d="${path}" fill="none" stroke="${colors[0]}" stroke-opacity=".12" stroke-width="12" stroke-linecap="round" /><g mask="url(#focus-shape-${index})"><rect width="326" height="144" fill="url(#focus-tone-${index})" /><rect width="326" height="144" fill="url(#focus-tip-${index})" /></g></svg>`;
  }).join('');
}

interface LaneFrame { focus: Focus; progress: number; icon: Asset; colors: string[] }
export type FocusFrame = LaneFrame[];

/** Sample the actual visible state so rapid day changes don't jump back. */
export function captureFocus(tracks: HTMLElement): FocusFrame {
  const reels = [...tracks.querySelectorAll<HTMLElement>('.focus-reel-strip')];
  return [...tracks.querySelectorAll<SVGSVGElement>('.focus-lane')].map((lane, index) => {
    const focus = lane.dataset.focus as Focus;
    const reel = reels[index];
    const transform = getComputedStyle(reel).transform;
    const translation = transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42;
    const height = parseFloat(getComputedStyle(reel.firstElementChild!).height);
    const visible = reel.children[Math.max(0, Math.min(reel.children.length - 1, Math.round(-translation / height)))];
    return {
      focus,
      progress: clamp(1 - parseFloat(getComputedStyle(lane.querySelector('[data-focus-mask]')!).strokeDashoffset)),
      icon: (visible.querySelector<HTMLImageElement>('img')?.dataset.asset as Asset) ?? categories[focus].icon,
      colors: [...lane.querySelectorAll('[data-tone-stop]')].map(stop => getComputedStyle(stop).stopColor),
    };
  });
}

export function focusReels(focuses: DailyFocuses): string {
  return `<div class="focus-reels" aria-hidden="true">${focuses.map(focus =>
    `<span class="focus-reel"><span class="focus-reel-window"><span class="focus-reel-strip">${cell(categories[focus].icon)}</span></span></span>`
  ).join('')}</div>`;
}

function sequence(from: Asset, target: Asset, count: number): Asset[] {
  const result = [from];
  for (let index = 0; index < count; index++) {
    const options = symbols.filter(symbol => symbol !== result.at(-1) && (index < count - 1 || symbol !== target));
    result.push(options[Math.floor(Math.random() * options.length)]);
  }
  return [...result, target];
}

export function animateFocusChange(tracks: HTMLElement, previous?: FocusFrame): () => void {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const next = captureFocus(tracks);
  const changed = next.map((lane, index) => !previous || previous[index].focus !== lane.focus || previous[index].icon !== lane.icon || Math.abs(previous[index].progress - lane.progress) > .001 || previous[index].colors.some((color, i) => color !== lane.colors[i]));
  const animations: Animation[] = [];
  const reels = [...tracks.querySelectorAll<HTMLElement>('.focus-reel-strip')];
  const artwork = [...tracks.querySelectorAll<SVGSVGElement>('.focus-lane')];
  const restorations: Array<() => void> = [];
  let frame = 0;
  let stopped = false;

  function finish(): void {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    tracks.dataset.entryAnimation = 'complete';
    restorations.forEach(restore => restore());
    animations.forEach(animation => animation.cancel());
    reels.forEach((reel, index) => { reel.innerHTML = cell(next[index].icon); });
    reducedMotion.removeEventListener('change', onMotionChange);
  }
  function onMotionChange(): void { if (reducedMotion.matches) finish(); }
  if (reducedMotion.matches || !changed.some(Boolean)) { finish(); return finish; }
  reducedMotion.addEventListener('change', onMotionChange);
  tracks.dataset.entryAnimation = 'preparing';

  const sequences = next.map((lane, index) => sequence(previous?.[index].icon ?? lane.icon, lane.icon, previous ? 5 + index : 10 + index * 2));
  // Prepare synchronously before waiting for icon decode, avoiding a flash of the final state.
  next.forEach((lane, index) => {
    if (!changed[index]) return;
    reels[index].innerHTML = sequences[index].map(cell).join('');
    const path = artwork[index].querySelector<SVGPathElement>('[data-focus-mask]')!;
    path.style.strokeDashoffset = offset(previous?.[index].progress ?? 0);
    restorations.push(() => path.style.removeProperty('stroke-dashoffset'));
    const track = artwork[index].querySelector<SVGPathElement>('[data-track-tone]')!;
    track.style.stroke = previous?.[index].colors[0] ?? lane.colors[0];
    restorations.push(() => track.style.removeProperty('stroke'));
    artwork[index].querySelectorAll<SVGStopElement>('[data-tone-stop], [data-tip-stop]').forEach((stop, i) => {
      stop.style.stopColor = previous?.[index].colors[Math.min(i, 2)] ?? lane.colors[Math.min(i, 2)];
      restorations.push(() => stop.style.removeProperty('stop-color'));
    });
  });

  void Promise.allSettled([...tracks.querySelectorAll<HTMLImageElement>('img')].map(img => img.decode())).then(() => {
    if (stopped) return;
    frame = requestAnimationFrame(() => {
      if (stopped) return;
      tracks.dataset.entryAnimation = 'running';
      const tokens = getComputedStyle(tracks);
      const ms = (name: string): number => {
        const value = tokens.getPropertyValue(name).trim();
        return parseFloat(value) * (value.endsWith('ms') ? 1 : 1000);
      };
      const easing = tokens.getPropertyValue('--ease-focus-reveal').trim();
      const height = parseFloat(getComputedStyle(reels[0].firstElementChild!).height);
      next.forEach((lane, index) => {
        if (!changed[index]) return;
        const delay = previous ? 160 + index * 60 : ms('--focus-reel-delay') + ms('--focus-reel-duration') + index * ms('--focus-reel-stagger') - ms('--focus-reveal-overlap');
        const distance = (sequences[index].length - 1) * height;
        animations.push(reels[index].animate([
          { transform: 'translateY(0)', filter: 'blur(0px)', offset: 0, easing: 'cubic-bezier(.45,0,.8,.55)' },
          { transform: `translateY(${-distance * .52}px)`, filter: 'blur(1px)', offset: .34, easing: 'cubic-bezier(.16,1,.3,1)' },
          { transform: `translateY(${-distance - 2}px)`, filter: 'blur(0px)', offset: .88, easing: 'ease-out' },
          { transform: `translateY(${-distance}px)`, filter: 'blur(0px)', offset: 1 },
        ], { duration: previous ? 580 + index * 60 : ms('--focus-reel-duration') + index * ms('--focus-reel-stagger'), delay: previous ? 0 : ms('--focus-reel-delay'), fill: 'both' }));
        const path = artwork[index].querySelector<SVGPathElement>('[data-focus-mask]')!;
        animations.push(path.animate([
          { strokeDashoffset: offset(previous?.[index].progress ?? 0) }, { strokeDashoffset: offset(lane.progress) },
        ], { duration: previous ? 640 : ms('--focus-reveal-duration'), delay, easing, fill: 'both' }));
        const track = artwork[index].querySelector<SVGPathElement>('[data-track-tone]')!;
        const oldColor = previous?.[index].colors[0] ?? lane.colors[0];
        if (oldColor !== lane.colors[0]) animations.push(track.animate([{ stroke: oldColor }, { stroke: lane.colors[0] }], { duration: 400, delay: 80 + index * 60, easing, fill: 'both' }));
        artwork[index].querySelectorAll<SVGStopElement>('[data-tone-stop], [data-tip-stop]').forEach((stop, i) => {
          const colorIndex = Math.min(i, 2);
          const from = previous?.[index].colors[colorIndex] ?? lane.colors[colorIndex];
          const to = lane.colors[colorIndex];
          if (from !== to) animations.push(stop.animate([{ stopColor: from }, { stopColor: to }], { duration: 400, delay: 80 + index * 60, easing, fill: 'both' }));
        });
      });
      void Promise.allSettled(animations.map(animation => animation.finished)).then(finish);
    });
  });
  return finish;
}
