import type { Rect } from './case-layout';
import type { CaseScene } from './case-scenes';

const rectPath = (r: Rect, radius = 0) => {
  const d = Math.min(radius, r.width / 2, r.height / 2);
  return `M${r.x + d},${r.y}h${r.width - 2 * d}q${d},0 ${d},${d}v${r.height - 2 * d}q0,${d} ${-d},${d}h${-r.width + 2 * d}q${-d},0 ${-d},${-d}v${-r.height + 2 * d}q0,${-d} ${d},${-d}Z`;
};
const attr = (node: Element, name: string, value: string | number) => {
  const text = String(value);
  if (node.getAttribute(name) !== text) node.setAttribute(name, text);
};

export function createCaseEffects(stage: HTMLElement) {
  const svg = stage.querySelector<SVGSVGElement>('.tour-overlay')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let arrowAnimations: Animation[] = [];
  let visible = false;
  let activeScene: CaseScene | undefined;
  const radii = new WeakMap<HTMLElement, number>();
  const sides = ['before', 'after'] as const;
  // Build the SVG once. Scrolling updates geometry, never replaces painted nodes.
  svg.innerHTML = `<defs>
    <marker id="tour-arrowhead" markerWidth="22" markerHeight="22" refX="6" refY="4.5" orient="auto" markerUnits="userSpaceOnUse" viewBox="0 0 9 9"><path d="M2 1.5L6 4.5L2 7.5" fill="none" stroke="#242424" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker>
    <marker id="tour-arrowhead-halo" markerWidth="22" markerHeight="22" refX="6" refY="4.5" orient="auto" markerUnits="userSpaceOnUse" viewBox="0 0 9 9"><path d="M2 1.5L6 4.5L2 7.5" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></marker>
  </defs>${sides.map(side => `<defs><clipPath id="tour-clip-${side}"><rect data-clip="${side}"/></clipPath></defs><g data-side="${side}"><g clip-path="url(#tour-clip-${side})"><path data-dim="${side}" fill="#181818" fill-opacity=".23" fill-rule="evenodd"/>${[0, 1].map(() => '<rect class="tour-outline-halo" fill="none" stroke="white" stroke-width="5.5" pathLength="1"/><rect class="tour-outline" fill="none" stroke="#242424" stroke-width="2" pathLength="1"/>').join('')}</g>${[0, 1].map(() => '<path class="tour-arrow-halo" fill="none" stroke="white" stroke-width="6.5" stroke-linecap="round" marker-end="url(#tour-arrowhead-halo)" pathLength="1"/><path class="tour-arrow" fill="none" stroke="#242424" stroke-width="2.5" stroke-linecap="round" marker-end="url(#tour-arrowhead)" pathLength="1"/>').join('')}</g>`).join('')}`;
  svg.style.visibility = 'hidden';
  const layers = sides.map(side => {
    const device = stage.querySelector<HTMLElement>(`[data-case-device="${side}"]`)!;
    const group = svg.querySelector<SVGGElement>(`[data-side="${side}"]`)!;
    return {
      side, device, group,
      screen: device.querySelector<HTMLElement>('.device-screen')!,
      clip: svg.querySelector<SVGRectElement>(`[data-clip="${side}"]`)!,
      dim: svg.querySelector<SVGPathElement>(`[data-dim="${side}"]`)!,
      outlines: [...group.querySelectorAll<SVGRectElement>('.tour-outline')],
      arrows: [...group.querySelectorAll<SVGPathElement>('.tour-arrow')],
      outlineHalos: [...group.querySelectorAll<SVGRectElement>('.tour-outline-halo')],
      arrowHalos: [...group.querySelectorAll<SVGPathElement>('.tour-arrow-halo')],
      targets: [] as HTMLElement[],
    };
  });
  function draw(scene: CaseScene, animate = false): void {
    const sceneChanged = scene !== activeScene;
    activeScene = scene;
    const stageRect = stage.getBoundingClientRect();
    // Read both phones before writing any SVG attribute.
    const snapshots = layers.map(layer => {
      const { side, device } = layer;
      if (sceneChanged || layer.targets.some(node => !node.isConnected)) {
        layer.targets = scene[side].map(id => device.querySelector<HTMLElement>(`[data-${side === 'before' ? 'before' : 'case'}-anchor="${id}"]`)).filter((node): node is HTMLElement => !!node);
      }
      const screen = layer.screen.getBoundingClientRect();
      const viewport: Rect = { x: screen.left - stageRect.left, y: screen.top - stageRect.top, width: screen.width, height: screen.height };
      const areas = layer.targets.map(node => {
        const r = node.getBoundingClientRect();
        const x = Math.max(viewport.x, r.left - stageRect.left - 3);
        const y = Math.max(viewport.y, r.top - stageRect.top - 3);
        const scale = r.width / node.offsetWidth;
        let radius = radii.get(node);
        if (radius === undefined) { radius = side === 'before' ? 20 : parseFloat(getComputedStyle(node).borderTopLeftRadius); radii.set(node, radius); }
        return { x, y, width: Math.max(0, Math.min(viewport.x + viewport.width, r.right - stageRect.left + 3) - x), height: Math.max(0, Math.min(viewport.y + viewport.height, r.bottom - stageRect.top + 3) - y), radius: Math.max(9, radius * scale + 3) };
      }).filter(r => r.height > 4 && r.width > 4);
      return { layer, viewport, areas };
    });
    if (!visible) { svg.style.visibility = 'visible'; visible = true; }
    attr(svg, 'viewBox', `0 0 ${stageRect.width} ${stageRect.height}`);
    for (const { layer, viewport, areas } of snapshots) {
      attr(layer.group, 'display', layer.targets.length ? 'inline' : 'none');
      if (!layer.targets.length) continue;
      for (const [key, value] of Object.entries(viewport)) attr(layer.clip, key, value);
      attr(layer.clip, 'rx', viewport.width * .09);
      attr(layer.dim, 'd', rectPath(viewport) + areas.map(r => rectPath(r, r.radius)).join(''));
      layer.outlines.forEach((outline, i) => {
        const r = areas[i], arrow = layer.arrows[i];
        const outlineHalo = layer.outlineHalos[i], arrowHalo = layer.arrowHalos[i];
        [outline, outlineHalo, arrow, arrowHalo].forEach(node => attr(node, 'display', r ? 'inline' : 'none'));
        if (!r) return;
        for (const node of [outline, outlineHalo]) {
          for (const key of ['x', 'y', 'width', 'height'] as const) attr(node, key, r[key]);
          attr(node, 'rx', Math.min(r.radius, r.width / 2, r.height / 2));
        }
        const sign = layer.side === 'before' ? -1 : 1;
        const endX = layer.side === 'before' ? r.x : r.x + r.width;
        const endY = r.y + Math.min(30, r.height / 2);
        const startX = layer.side === 'before' ? viewport.x - 17 : viewport.x + viewport.width + 17;
        for (const node of [arrow, arrowHalo]) attr(node, 'd', `M${startX},${endY - 34} C${startX + sign * 13},${endY - 13} ${endX + sign * 23},${endY} ${endX + sign * 3},${endY}`);
      });
    }
    if (animate && !reduced.matches) {
      arrowAnimations.forEach(animation => animation.cancel());
      arrowAnimations = layers.flatMap(layer => [...layer.arrows, ...layer.outlines, ...layer.arrowHalos, ...layer.outlineHalos]).filter(node => node.getAttribute('display') !== 'none').map(node => node.animate([
        { strokeDasharray: '1', strokeDashoffset: '1', opacity: 0 },
        { strokeDasharray: '1', strokeDashoffset: '0', opacity: 1 },
      ], { duration: 360, easing: 'cubic-bezier(.22,1,.36,1)' }));
    }
  }
  const clear = () => {
    if (!visible) return;
    arrowAnimations.forEach(animation => animation.cancel()); arrowAnimations = [];
    svg.style.visibility = 'hidden'; visible = false;
  };
  return { draw, clear, dispose: () => { clear(); svg.replaceChildren(); } };
}
