import { comparisonLayout } from './case-layout';
import { caseScenes } from './case-scenes';
import type { CaseAppAdapter } from './case-app-adapter';
import { createCaseEffects } from './case-effects';
import { clamp, follow, smoothStep } from './case-motion';
import { CaseWheelMotion, wheelPixels } from './case-wheel';
import { createPrototypeViewer } from './prototype-viewer';

export function setupCaseTour(adapter: CaseAppAdapter): () => void {
  const stage = document.querySelector<HTMLElement>('.comparison-stage')!;
  const pair = stage.querySelector<HTMLElement>('.compare-devices')!;
  const track = document.querySelector<HTMLElement>('.tour-track')!;
  const previews = [...stage.querySelectorAll<HTMLElement>('.case-preview')];
  const panel = stage.querySelector<HTMLElement>('.tour-explanation')!;
  const intro = stage.querySelector<HTMLElement>('.case-intro')!;
  const before = stage.querySelector<HTMLElement>('[data-case-device="before"]')!;
  const after = stage.querySelector<HTMLElement>('[data-case-device="after"]')!;
  const caption = after.querySelector<HTMLElement>('.device-caption')!;
  const copy = stage.querySelector<HTMLElement>('.tour-copy')!;
  const overlay = stage.querySelector<SVGSVGElement>('.tour-overlay')!;
  const title = document.querySelector<HTMLElement>('#tour-title')!;
  const body = document.querySelector<HTMLElement>('#tour-body')!;
  const story = document.querySelector<HTMLElement>('.case-story')!;
  const stops = [...document.querySelectorAll<HTMLElement>('.tour-stop')];
  const previous = panel.querySelector<HTMLButtonElement>('[data-tour="previous"]')!;
  const next = panel.querySelector<HTMLButtonElement>('[data-tour="next"]')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let current = -1;
  let requested: number | null = null;
  let free = false;
  let logProgress = 0;
  let running: AbortController | undefined;
  let frame = 0;
  let pageFrame = 0;
  let wheelMotion: CaseWheelMotion | undefined;
  let lastWheelFrame = 0;
  let wheelMaximum = 0;
  let reveal = 0;
  let travel = 0;
  let lastFrame = 0;
  let initialized = false;
  let copyAnimation: Animation | undefined;
  let effectsFrame = 0;
  let drawArrows = false;
  let geometryDirty = true;
  let geometry = { width: 0, height: 0, trackTop: 0, storyTop: 0, stopTops: [] as number[] };
  const styles = new WeakMap<HTMLElement, Map<string, string>>();
  function style(node: HTMLElement, key: string, value: string): void {
    let values = styles.get(node);
    if (!values) { values = new Map(); styles.set(node, values); }
    if (values.get(key) === value) return;
    node.style.setProperty(key, value);
    values.set(key, value);
  }
  const inert = (node: HTMLElement, value: boolean) => { if (node.inert !== value) node.inert = value; };
  const data = (node: HTMLElement, key: string, value: string) => { if (node.dataset[key] !== value) node.dataset[key] = value; };

  function cancelCopy(): void {
    copyAnimation?.cancel();
    copyAnimation = undefined;
    copy.style.opacity = '1';
  }

  function changeCopy(index: number, immediate: boolean): void {
    cancelCopy();
    const scene = caseScenes[index];
    // Publish the latest copy synchronously. Never leave the text hidden while
    // waiting for a cancelled outgoing animation during rapid navigation.
    title.textContent = scene.title;
    body.innerHTML = scene.paragraphs.map(paragraph => `<p>${paragraph}</p>`).join('');
    copy.scrollTop = 0;
    panel.querySelector('[data-tour-position]')!.textContent = `${index + 2} / ${caseScenes.length + 1}`;
    if (!immediate && !reduced.matches) {
      const animation = copy.animate([{ opacity: .65 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' });
      copyAnimation = animation;
      animation.onfinish = () => {
        if (copyAnimation === animation) { animation.cancel(); copyAnimation = undefined; }
      };
    }
  }

  const highlights = createCaseEffects(stage);
  function effects(animate = false): void {
    drawArrows ||= animate;
    if (!effectsFrame) effectsFrame = requestAnimationFrame(() => {
      effectsFrame = 0;
      renderEffects(drawArrows);
      drawArrows = false;
    });
  }
  function renderEffects(animate: boolean): void {
    if (free || logProgress > .05 || current < 0 || reveal < .999) highlights.clear();
    // Keep the outgoing spotlight while it fades. Measuring and moving its
    // cutouts during the phone scroll both forces layout and exposes a jump
    // to the incoming anchors before they have reached their destination.
    else if (!overlay.classList.contains('is-transitioning')) highlights.draw(caseScenes[current], animate);
  }

  function enter(index: number, force = false): void {
    if (index === current && !force) return;
    const first = current < 0;
    current = index;
    const scene = caseScenes[index];
    void changeCopy(index, first || force);
    previous.disabled = false;
    previous.setAttribute('aria-label', index === 0 ? 'Вернуться к гипотезе' : 'Предыдущий шаг');
    next.setAttribute('aria-label', index === caseScenes.length - 1 ? 'Перейти к хронологии' : 'Следующий шаг');
    running?.abort();
    if (free) return;
    overlay.classList.add('is-transitioning');
    running = new AbortController();
    const signal = running.signal;
    void adapter.enter(scene, signal, () => effects()).then(() => {
      if (!signal.aborted) { overlay.classList.remove('is-transitioning'); effects(true); }
    }).catch(error => {
      if (!signal.aborted) console.error('Не удалось показать сравнение', error);
    });
  }

  function update(now = performance.now()): void {
    frame = 0;
    if (viewer.isOpen) return;
    const resized = geometryDirty;
    if (resized) {
      // Read all layout once, before writes. Scroll positions then use cached
      // document coordinates instead of forcing layout eight times per frame.
      geometry = {
        height: stage.clientHeight, width: stage.clientWidth,
        trackTop: track.getBoundingClientRect().top + window.scrollY,
        storyTop: story.getBoundingClientRect().top + window.scrollY,
        stopTops: stops.map(stop => stop.getBoundingClientRect().top + window.scrollY),
      };
      geometryDirty = false;
    }
    const { height, width } = geometry;
    const oldLog = logProgress;
    const oldReveal = reveal, oldTravel = travel;
    logProgress = clamp((height * 1.65 - (geometry.storyTop - window.scrollY)) / (height * .7));
    const scroll = Math.max(0, window.scrollY - geometry.trackTop);
    const revealTarget = smoothStep((scroll / height - .08) / .5);
    const travelTarget = smoothStep((logProgress - .25) / .75);
    const elapsed = Math.min(64, now - lastFrame || 16);
    lastFrame = now;
    reveal = !initialized || reduced.matches ? revealTarget : follow(reveal, revealTarget, elapsed);
    travel = !initialized || reduced.matches ? travelTarget : follow(travel, travelTarget, elapsed);
    initialized = true;
    const layout = comparisonLayout(width, height, reduced.matches ? (travel >= .5 ? 1 : 0) : travel);
    data(stage, 'compact', String(layout.compact));
    data(stage, 'mode', free || logProgress > 0 ? 'free' : 'guided');
    previews.forEach(device => inert(device, stage.dataset.mode === 'guided'));
    style(pair, 'width', `${layout.pair.width}px`);
    style(pair, 'transform', `translate3d(${layout.pair.x}px,${layout.pair.y}px,0)`);
    style(pair, 'opacity', String(layout.compact ? 1 - logProgress : 1));
    inert(pair, layout.compact && logProgress > .5);
    style(before, 'opacity', String(reduced.matches ? Number(reveal >= .5) : reveal));
    style(before, 'transform', `translate3d(${reduced.matches ? 0 : -56 * (1 - reveal)}px,0,0)`);
    inert(before, reveal < .99);
    style(after, 'transform', `translate3d(${layout.soloOffset * (1 - (reduced.matches ? Number(reveal >= .5) : reveal))}px,0,0)`);
    const label = reveal < .5 ? 'Результат' : 'После';
    if (caption.textContent !== label) caption.textContent = label;
    const introOpacity = 1 - smoothStep(reveal / .55);
    const panelOpacity = smoothStep((reveal - .55) / .45) * (1 - smoothStep(logProgress * 4));
    [intro, panel].forEach(node => {
      style(node, 'left', `${layout.text.x}px`); style(node, 'top', `${layout.text.y}px`);
      style(node, 'width', `${layout.text.width}px`); style(node, 'height', `${layout.text.height}px`);
    });
    style(intro, 'opacity', String(introOpacity));
    style(intro, 'visibility', introOpacity > .001 ? 'visible' : 'hidden');
    inert(intro, reveal > .1);
    style(panel, 'opacity', String(panelOpacity));
    style(panel, 'visibility', panelOpacity > .001 ? 'visible' : 'hidden');
    inert(panel, logProgress > .1 || reveal < .95);
    style(story, 'width', `${layout.logWidth}px`);
    let index = revealTarget > .55 ? 0 : -1;
    geometry.stopTops.forEach((top, i) => { if (top - window.scrollY <= height * .4) index = i; });
    if (requested === index || logProgress > 0) requested = null;
    if (logProgress === 0 && index >= 0) enter(index, oldLog > 0);
    else if (index < 0 && current >= 0) {
      current = -1;
      cancelCopy();
      running?.abort();
      if (!free) {
        running = new AbortController();
        const signal = running.signal;
        void adapter.enter(caseScenes[0], signal, () => {}).catch(error => { if (!signal.aborted) console.error(error); });
      }
    }
    else if (logProgress > 0 && oldLog === 0) {
      running?.abort();
      if (!free) {
        running = new AbortController();
        const signal = running.signal;
        void adapter.enter(caseScenes[0], signal, () => {}).catch(error => { if (!signal.aborted) console.error(error); });
      }
    }
    if (resized || oldLog !== logProgress || oldReveal !== reveal || oldTravel !== travel) effects();
    if (reveal !== revealTarget || travel !== travelTarget) schedule();
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  const cancelPageTravel = () => { cancelAnimationFrame(pageFrame); pageFrame = 0; wheelMotion = undefined; requested = null; };
  function moveWheelPage(now: number): void {
    pageFrame = 0;
    if (!wheelMotion) return;
    const top = wheelMotion.step(lastWheelFrame ? now - lastWheelFrame : 16, reduced.matches);
    lastWheelFrame = now;
    window.scrollTo({ top, behavior: 'instant' });
    // Native wheel scrolling runs on a separate browser clock. Drive the page
    // and its presentation together, rather than waiting another scroll frame.
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    update(now);
    if (wheelMotion.settled) wheelMotion = undefined;
    else pageFrame = requestAnimationFrame(moveWheelPage);
  }
  function onWheel(event: WheelEvent): void {
    if (viewer.isOpen) return;
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || !event.deltaY || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    const target = event.target instanceof Element ? event.target : null;
    // Do not take over zooming, a modal, long copy or the interactive app.
    const nested = target?.closest<HTMLElement>('.tour-copy, .intro-copy, .case-preview, dialog, .reference-scroll');
    if (nested && (nested.matches('.case-preview, dialog, .reference-scroll') || nested.scrollHeight > nested.clientHeight + 1)) return;
    const tourEnd = geometry.storyTop - geometry.height * .95;
    if (!event.cancelable || reduced.matches || free || window.scrollY < geometry.trackTop || window.scrollY >= tourEnd) {
      cancelPageTravel();
      return;
    }
    event.preventDefault();
    if (!wheelMotion) {
      cancelPageTravel();
      wheelMotion = new CaseWheelMotion(window.scrollY);
      lastWheelFrame = 0;
      wheelMaximum = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    }
    wheelMotion.push(wheelPixels(event.deltaY, event.deltaMode, geometry.height), wheelMaximum);
    if (!pageFrame) pageFrame = requestAnimationFrame(moveWheelPage);
  }
  function jump(index: number): void {
    cancelPageTravel();
    requested = index;
    // The outgoing controls become inert during the hand-off. Release their
    // focus before scrolling so the browser cannot pull the page back to them.
    if (index === caseScenes.length && document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const target = index < 0 ? track : stops[index] ?? story;
    const top = target.getBoundingClientRect().top + window.scrollY;
    const from = window.scrollY;
    const distance = top - from;
    const duration = Math.min(900, 420 + Math.abs(distance) * .12);
    const started = performance.now();
    // Own this clock: native smooth scrolling can be cancelled by the nested
    // phone scroll used to restore a scene in the same frame.
    const tick = (now: number) => {
      const progress = reduced.matches ? 1 : Math.min(1, (now - started) / duration);
      window.scrollTo({ top: from + distance * smoothStep(progress), behavior: 'instant' });
      pageFrame = progress < 1 ? requestAnimationFrame(tick) : 0;
    };
    pageFrame = requestAnimationFrame(tick);
  }
  const onKey = (event: KeyboardEvent) => { if (['PageDown', 'PageUp', 'Home', 'End', 'ArrowDown', 'ArrowUp', ' '].includes(event.key)) cancelPageTravel(); };
  const onClick = (event: Event) => {
    const action = (event.target as Element).closest<HTMLElement>('[data-tour]')?.dataset.tour;
    if (action === 'start' || action === 'chronology') {
      event.preventDefault();
      (event.target as Element).closest<HTMLElement>('[data-tour]')?.blur();
      jump(action === 'start' ? 0 : caseScenes.length);
    }
    if (action === 'previous') jump(Math.max(-1, (requested ?? current) - 1));
    if (action === 'next') jump(Math.min(caseScenes.length, (requested ?? current) + 1));
    if (action === 'free') {
      cancelPageTravel();
      free = true;
      running?.abort();
      highlights.clear();
      // Let the adapter commit any interrupted phone movement before moving
      // that same live DOM into the fullscreen viewer.
      const trigger = (event.target as Element).closest<HTMLButtonElement>('[data-tour="free"]')!;
      queueMicrotask(() => viewer.open(trigger));
    }
  };
  const viewer = createPrototypeViewer(previews[1], () => {
    free = false;
    geometryDirty = true;
    lastFrame = 0;
    update();
    if (current >= 0) enter(current, true);
    else {
      running = new AbortController();
      const signal = running.signal;
      void adapter.enter(caseScenes[0], signal, () => {}).catch(error => { if (!signal.aborted) console.error(error); });
    }
  });
  const innerScroll = () => { if (free || logProgress > 0) return; effects(); };
  const resizeGeometry = () => { cancelPageTravel(); geometryDirty = true; schedule(); };
  const onPageScroll = () => { if (!wheelMotion) schedule(); };
  stage.addEventListener('click', onClick);
  stage.addEventListener('scroll', innerScroll, true);
  window.addEventListener('scroll', onPageScroll, { passive: true });
  window.addEventListener('resize', resizeGeometry);
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('pointerdown', cancelPageTravel, { passive: true });
  window.addEventListener('touchstart', cancelPageTravel, { passive: true });
  window.addEventListener('keydown', onKey);
  reduced.addEventListener('change', schedule);
  const resize = new ResizeObserver(resizeGeometry);
  resize.observe(stage);
  update();
  return () => {
    viewer.dispose();
    running?.abort(); cancelCopy(); cancelAnimationFrame(frame); cancelAnimationFrame(effectsFrame); cancelPageTravel(); resize.disconnect();
    highlights.dispose();
    stage.removeEventListener('click', onClick);
    stage.removeEventListener('scroll', innerScroll, true);
    window.removeEventListener('scroll', onPageScroll);
    window.removeEventListener('resize', resizeGeometry);
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('pointerdown', cancelPageTravel);
    window.removeEventListener('touchstart', cancelPageTravel);
    window.removeEventListener('keydown', onKey);
    reduced.removeEventListener('change', schedule);
  };
}
