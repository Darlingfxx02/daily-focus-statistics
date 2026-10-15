import { dismissDistance, wheelDismissDistance, wheelReleaseDelay, elasticOffset, EdgePullGesture } from './prototype-gesture';
import { advancePosition } from './case-motion';
import { blendRect, rectTransform, springProgress, type ViewRect } from './prototype-motion';
import './prototype-viewer.css';

/** Move the existing app into a top-layer viewer; never clone or reload it. */
export function createPrototypeViewer(preview: HTMLElement, onClose: () => void) {
  const viewer = document.createElement('dialog');
  viewer.className = 'prototype-viewer';
  viewer.setAttribute('aria-label', 'Исследовать макет');
  viewer.innerHTML = `<div class="prototype-scrim" aria-hidden="true"></div><button type="button" class="prototype-close" aria-label="Вернуться к кейсу" autofocus><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg><span>К кейсу</span></button><div class="prototype-stage"></div><span class="sr-only">На верхней границе потяните вниз, на нижней — вверх, чтобы вернуться к кейсу. Также можно нажать Escape или кнопку «К кейсу».</span>`;
  document.body.append(viewer);
  const host = viewer.querySelector<HTMLElement>('.prototype-stage')!;
  const closeButton = viewer.querySelector<HTMLButtonElement>('.prototype-close')!;
  const scrim = viewer.querySelector<HTMLElement>('.prototype-scrim')!;
  const scroll = preview.querySelector<HTMLElement>('.main-scroll')!;
  const mobile = matchMedia('(max-width: 600px), (pointer: coarse) and (max-height: 600px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const placeholder = document.createElement('div');
  placeholder.className = 'case-preview prototype-placeholder';
  placeholder.setAttribute('aria-hidden', 'true');
  let opener: HTMLElement | null = null;
  let pageTop = 0;
  let bodyStyle = '';
  let rootOverflow = '';
  let oldWidth = '';
  let oldScale = '';
  let oldInert = false;
  let pullTarget = 0;
  let pullState = { position: 0, velocity: 0 };
  let pullFrame = 0, pullTime = 0;
  let pullReturn: Animation | undefined;
  let touch: { x: number; y: number; gesture: EdgePullGesture } | undefined;
  let wheelGesture: EdgePullGesture | undefined;
  let wheelRelease = 0;
  let wheelAt = 0;
  let wheelTailUntil = 0, wheelTailDirection = 0;
  let closing = false;
  let phase: 'closed' | 'opening' | 'open' | 'closing' = 'closed';
  let flight: Animation | undefined;
  let surface: Animation | undefined;
  let controls: Animation | undefined;
  let origin: ViewRect;
  let motionRevision = 0;

  function stopFlight(): void {
    motionRevision++;
    flight?.cancel(); surface?.cancel(); controls?.cancel();
    flight = surface = controls = undefined;
  }
  function setPhase(value: typeof phase): void {
    phase = value;
    viewer.dataset.phase = value;
  }
  function fly(from: ViewRect, to: ViewRect, finish: () => void): void {
    const opacity = getComputedStyle(scrim).opacity;
    const controlOpacity = getComputedStyle(closeButton).opacity;
    stopFlight();
    const revision = motionRevision;
    if (reduced.matches) { finish(); return; }
    // Animate the actual app surface, with its live scroll and controls intact.
    // Its final layout is calculated once; only compositor transforms move it.
    const base = preview.getBoundingClientRect();
    const duration = closing ? 240 : 420;
    const samples = springProgress(duration);
    const timing = { duration, easing: 'linear', fill: 'both' as const };
    flight = preview.animate(samples.map(({ offset, progress }) => ({ offset, transform: rectTransform(blendRect(from, to, progress), base) })), timing);
    const targetOpacity = closing ? 0 : 1;
    surface = scrim.animate(samples.map(({ offset, progress }) => ({ offset, opacity: +opacity + (targetOpacity - +opacity) * progress })), timing);
    controls = closeButton.animate(samples.map(({ offset, progress }) => ({ offset, opacity: +controlOpacity + (targetOpacity - +controlOpacity) * progress })), timing);
    void flight.finished.then(() => { if (revision === motionRevision) finish(); }).catch(() => {});
  }

  function fit(): void {
    if (!viewer.open) return;
    const style = getComputedStyle(preview);
    const ratio = parseFloat(style.getPropertyValue('--shell-ratio'));
    const width = Math.min(viewer.clientWidth - 32, (viewer.clientHeight - 32) * ratio);
    preview.style.width = mobile.matches ? '100%' : `${width}px`;
    const shellWidth = parseFloat(style.getPropertyValue('--shell-width'));
    preview.style.setProperty('--device-scale', String(width / shellWidth));
  }
  function movePull(now: number): void {
    pullFrame = 0;
    pullState = advancePosition(pullState, pullTarget, pullTime ? now - pullTime : 16, 38);
    pullTime = now;
    host.style.transform = pullState.position ? `translate3d(0,${pullState.position}px,0)` : '';
    if (pullState.position !== pullTarget || pullState.velocity) pullFrame = requestAnimationFrame(movePull);
    else pullTime = 0;
  }
  function paintPull(distance: number, direct = false): void {
    if (pullReturn) {
      pullState = { position: new DOMMatrix(getComputedStyle(host).transform).m42, velocity: 0 };
      pullReturn.cancel(); pullReturn = undefined;
      host.style.transform = `translate3d(0,${pullState.position}px,0)`;
    }
    pullTarget = reduced.matches ? 0 : elasticOffset(distance);
    if (direct) {
      cancelAnimationFrame(pullFrame); pullFrame = pullTime = 0;
      pullState = { position: pullTarget, velocity: 0 };
      host.style.transform = pullTarget ? `translate3d(0,${pullTarget}px,0)` : '';
      return;
    }
    if (!pullFrame) pullFrame = requestAnimationFrame(movePull);
  }
  function stopPull(): void {
    cancelAnimationFrame(pullFrame);
    pullFrame = pullTime = pullTarget = 0;
    pullState = { position: 0, velocity: 0 };
    pullReturn?.cancel(); pullReturn = undefined;
    host.style.transform = '';
  }
  function settlePull(): void {
    const from = new DOMMatrix(getComputedStyle(host).transform).m42;
    stopPull();
    if (reduced.matches || Math.abs(from) < .1) return;
    const animation = host.animate(springProgress(180).map(({ offset, progress }) => ({ offset, transform: `translate3d(0,${from * (1 - progress)}px,0)` })), { duration: 180, easing: 'linear' });
    pullReturn = animation;
    animation.onfinish = () => { if (pullReturn === animation) { animation.cancel(); pullReturn = undefined; } };
  }
  function clearGesture(): void {
    clearTimeout(wheelRelease);
    wheelRelease = 0;
    wheelGesture = undefined;
    wheelAt = 0;
    touch = undefined;
  }
  function cancelGesture(): void {
    clearGesture();
    settlePull();
  }
  function finishClose(): void {
    const exploredTop = scroll.scrollTop;
    stopFlight();
    clearGesture(); stopPull();
    placeholder.replaceWith(preview);
    preview.style.width = oldWidth;
    preview.style.setProperty('--device-scale', oldScale);
    preview.inert = oldInert;
    viewer.close();
    setPhase('closed');
    document.body.style.cssText = bodyStyle;
    document.documentElement.style.overflow = rootOverflow;
    window.scrollTo({ top: pageTop, behavior: 'instant' });
    // Moving a scroll container between parents can reset native scrollTop.
    // The adapter must resume from the position the visitor actually left.
    scroll.scrollTo({ top: exploredTop, behavior: 'instant' });
    opener?.focus({ preventScroll: true });
    onClose();
    closing = false;
    // Ignore only the tail of the wheel gesture that just dismissed the app.
    if (wheelTailDirection) wheelTailUntil = performance.now() + 160;
  }
  function close(): void {
    if (!viewer.open || closing) return;
    closing = true;
    const from = preview.getBoundingClientRect();
    // Snapshot before cancelling a partial opening or a pull gesture.
    clearGesture(); stopPull();
    setPhase('closing');
    fly(from, origin, finishClose);
  }
  function finishOpen(): void {
    stopFlight();
    setPhase('open');
    scrim.style.opacity = '1'; closeButton.style.opacity = '1';
  }
  function resize(): void {
    if (!viewer.open) return;
    if (closing) { finishClose(); return; }
    // A new viewport invalidates both FLIP rectangles. Settle safely before
    // fitting the new viewport rather than stretching a stale animation.
    clearGesture(); stopPull(); finishOpen(); fit();
    const r = placeholder.getBoundingClientRect();
    if (r.width && r.height) origin = r;
  }
  const blocked = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest('.phone-overlay, button, input, select, textarea'));
  function touchStart(event: TouchEvent): void {
    cancelGesture();
    if (phase !== 'open' || event.touches.length !== 1 || blocked(event.target)) return;
    const point = event.touches[0];
    touch = { x: point.clientX, y: point.clientY, gesture: new EdgePullGesture(scroll.scrollTop, scroll.scrollHeight - scroll.clientHeight) };
  }
  function touchMove(event: TouchEvent): void {
    if (!touch || event.touches.length !== 1) { cancelGesture(); return; }
    const point = event.touches[0];
    const distance = touch.gesture.move(point.clientX - touch.x, point.clientY - touch.y);
    if (touch.gesture.claimed) { event.preventDefault(); paintPull(distance, true); }
  }
  function touchEnd(): void {
    const dismiss = touch?.gesture.canDismiss(dismissDistance);
    clearGesture();
    if (dismiss) close();
    else settlePull();
  }
  function wheel(event: WheelEvent): void {
    if (phase === 'closing') { event.preventDefault(); return; }
    if (phase !== 'open') return;
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || blocked(event.target) || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) {
      cancelGesture(); return;
    }
    const now = performance.now();
    if (!wheelGesture || now - wheelAt > 240) wheelGesture = new EdgePullGesture(scroll.scrollTop, scroll.scrollHeight - scroll.clientHeight);
    wheelAt = now;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scroll.clientHeight : 1);
    const wasPulled = Boolean(wheelGesture.distance);
    const distance = wheelGesture.push(-delta);
    if (distance || wasPulled) { event.preventDefault(); paintPull(distance); }
    // A wheel has no pointerup. Wait for release; reversing even a strong pull
    // cancels dismissal. Keep the app live throughout the whole gesture.
    // Tiny trackpad inertia events must not postpone release indefinitely.
    if (wheelRelease && Math.abs(delta) < 3) return;
    clearTimeout(wheelRelease);
    wheelRelease = window.setTimeout(() => {
      const dismiss = phase === 'open' && wheelGesture?.canDismiss(wheelDismissDistance);
      if (dismiss) wheelTailDirection = -Math.sign(wheelGesture!.distance);
      wheelRelease = 0;
      if (dismiss) close();
      // Keep the gesture boundary between nearby mouse notches, but start
      // the visible return immediately instead of holding it for 240 ms.
      else settlePull();
    }, wheelReleaseDelay);
  }
  const wheelTail = (event: WheelEvent) => {
    if (phase !== 'closed' || !wheelTailDirection) return;
    if (performance.now() > wheelTailUntil || Math.sign(event.deltaY) !== wheelTailDirection || event.ctrlKey || event.metaKey) {
      wheelTailDirection = 0; return;
    }
    event.preventDefault(); event.stopPropagation();
  };
  const cancel = (event: Event) => { event.preventDefault(); close(); };
  const key = (event: KeyboardEvent) => {
    cancelGesture();
    // Give an open in-app dialog the first Escape, even if focus is outside it.
    const dialog = preview.querySelector<HTMLDialogElement>('.phone-dialog[open]');
    if (event.key === 'Escape' && dialog) {
      event.preventDefault(); event.stopPropagation();
      dialog.querySelector<HTMLButtonElement>('[data-action="close"]')?.click();
    }
  };
  viewer.addEventListener('cancel', cancel);
  viewer.addEventListener('keydown', key, true);
  closeButton.addEventListener('click', close);
  host.addEventListener('touchstart', touchStart, { passive: true });
  host.addEventListener('touchmove', touchMove, { passive: false });
  host.addEventListener('touchend', touchEnd);
  host.addEventListener('touchcancel', cancelGesture);
  host.addEventListener('wheel', wheel, { passive: false });
  viewer.addEventListener('pointerdown', cancelGesture, { passive: true });
  window.addEventListener('blur', cancelGesture);
  window.addEventListener('wheel', wheelTail, { capture: true, passive: false });
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);

  return {
    get isOpen() { return viewer.open; },
    open(trigger: HTMLElement): void {
      if (viewer.open) return;
      clearGesture(); stopPull();
      wheelTailDirection = 0;
      opener = trigger; pageTop = window.scrollY;
      origin = preview.getBoundingClientRect();
      const startingTop = scroll.scrollTop;
      bodyStyle = document.body.style.cssText;
      rootOverflow = document.documentElement.style.overflow;
      oldWidth = preview.style.width; oldInert = preview.inert;
      oldScale = preview.style.getPropertyValue('--device-scale');
      placeholder.style.cssText = preview.style.cssText;
      preview.before(placeholder);
      host.append(preview);
      preview.inert = false;
      viewer.showModal();
      setPhase('opening');
      scrim.style.opacity = '0'; closeButton.style.opacity = '0';
      // Fixed body also prevents background rubber-banding on mobile Safari.
      const gutter = window.innerWidth - document.documentElement.clientWidth;
      document.documentElement.style.overflow = 'hidden';
      Object.assign(document.body.style, { position: 'fixed', top: `${-pageTop}px`, width: '100%', overflow: 'hidden', paddingRight: `${gutter}px` });
      fit();
      scroll.scrollTo({ top: startingTop, behavior: 'instant' });
      const to = preview.getBoundingClientRect();
      fly(origin, to, finishOpen);
      closeButton.focus({ preventScroll: true });
    },
    dispose(): void {
      if (viewer.open) finishClose();
      clearGesture(); stopPull();
      window.removeEventListener('resize', resize);
      window.removeEventListener('blur', cancelGesture);
      window.removeEventListener('wheel', wheelTail, true);
      window.visualViewport?.removeEventListener('resize', resize);
      viewer.remove();
    },
  };
}
