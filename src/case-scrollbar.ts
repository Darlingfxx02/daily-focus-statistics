/** Custom chrome over native text scrolling; touch, wheel and selection stay native. */
export function setupCopyScrollbars(root: HTMLElement): () => void {
  const disposers = [...root.querySelectorAll<HTMLElement>('.intro-copy, .tour-copy')].map((copy, index) => {
    const rail = document.createElement('div');
    rail.className = 'copy-scrollbar';
    copy.id ||= `case-copy-${index}`;
    rail.setAttribute('role', 'scrollbar');
    rail.setAttribute('aria-label', 'Прокрутка пояснения');
    rail.setAttribute('aria-controls', copy.id);
    rail.setAttribute('aria-orientation', 'vertical');
    rail.setAttribute('aria-valuemin', '0');
    rail.innerHTML = '<span class="copy-scrollbar-thumb"></span>';
    copy.after(rail);
    const thumb = rail.firstElementChild as HTMLElement;
    let frame = 0;
    let range = 0, travel = 0, thumbHeight = 0, thumbTop = 0;
    let drag: { id: number; top: number; grab: number } | undefined;

    function paint(): void {
      frame = 0;
      const height = copy.clientHeight;
      range = Math.max(0, copy.scrollHeight - height);
      const visible = range > 1 && height > 0;
      rail.hidden = !visible;
      rail.tabIndex = visible ? 0 : -1;
      if (!visible) return;
      thumbHeight = Math.min(height, Math.max(28, height * height / copy.scrollHeight));
      travel = height - thumbHeight;
      thumbTop = Math.max(0, Math.min(1, copy.scrollTop / range)) * travel;
      thumb.style.height = `${thumbHeight}px`;
      thumb.style.transform = `translateY(${thumbTop}px)`;
      rail.setAttribute('aria-valuemax', String(Math.round(range)));
      rail.setAttribute('aria-valuenow', String(Math.round(Math.max(0, Math.min(range, copy.scrollTop)))));
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };
    const seek = (y: number) => {
      if (!drag || travel <= 0) return;
      copy.scrollTop = Math.max(0, Math.min(1, (y - drag.top - drag.grab) / travel)) * range;
      schedule();
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || range <= 1) return;
      event.preventDefault();
      cancelAnimationFrame(frame);
      paint();
      const top = rail.getBoundingClientRect().top;
      const offset = event.clientY - top;
      drag = { id: event.pointerId, top, grab: offset >= thumbTop && offset <= thumbTop + thumbHeight ? offset - thumbTop : thumbHeight / 2 };
      rail.setPointerCapture(event.pointerId);
      rail.dataset.dragging = 'true';
      seek(event.clientY);
    };
    const move = (event: PointerEvent) => { if (drag?.id === event.pointerId) seek(event.clientY); };
    const end = () => { drag = undefined; delete rail.dataset.dragging; };
    const key = (event: KeyboardEvent) => {
      const targets: Record<string, number> = {
        ArrowUp: copy.scrollTop - 40, ArrowDown: copy.scrollTop + 40,
        PageUp: copy.scrollTop - copy.clientHeight * .9, PageDown: copy.scrollTop + copy.clientHeight * .9,
        Home: 0, End: range,
      };
      if (!(event.key in targets)) return;
      event.preventDefault();
      copy.scrollTop = targets[event.key];
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(copy);
    [...copy.children].forEach(child => resize.observe(child));
    copy.addEventListener('scroll', schedule, { passive: true });
    rail.addEventListener('pointerdown', down);
    rail.addEventListener('pointermove', move);
    rail.addEventListener('pointerup', end);
    rail.addEventListener('pointercancel', end);
    rail.addEventListener('lostpointercapture', end);
    rail.addEventListener('keydown', key);
    paint();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      copy.removeEventListener('scroll', schedule);
      rail.remove();
    };
  });
  return () => disposers.forEach(dispose => dispose());
}
