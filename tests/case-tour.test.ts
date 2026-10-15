import assert from 'node:assert/strict';
import test from 'node:test';
import { comparisonLayout } from '../src/case-layout.ts';
import { beforeAnchors, caseScenes } from '../src/case-scenes.ts';
import { createCaseAdapter, scrollDestination } from '../src/case-app-adapter.ts';
import { advancePosition, follow, smoothStep } from '../src/case-motion.ts';

test('paired phones stay inside the stage; desktop copy and chronology have their own columns', () => {
  for (const [width, height] of [[1344, 900], [1050, 768], [960, 650], [700, 800], [350, 740], [280, 600]]) {
    const initial = comparisonLayout(width, height, 0);
    for (const progress of [0, .5, 1]) {
      const layout = comparisonLayout(width, height, progress);
      assert.ok(layout.pair.x >= 0);
      assert.ok(layout.pair.x + layout.pair.width <= width + .01);
      assert.ok(layout.pair.y + layout.pair.height <= height + .01);
      assert.equal(layout.pair.width, initial.pair.width, 'scroll must not resize the phones');
      assert.equal(layout.pair.height, initial.pair.height);
      assert.deepEqual(layout.text, initial.text, 'the text/control area stays anchored');
      if (!layout.compact && progress === 0) assert.ok(layout.pair.width + 32 <= layout.text.x);
      if (!layout.compact && progress === 1) assert.ok(layout.logWidth + 32 <= layout.pair.x);
    }
  }
});

test('pose smoothing is monotonic, settles exactly and reverses without a reset', () => {
  let value = 0;
  for (let i = 0; i < 70; i++) {
    const next = follow(value, 1, 16);
    assert.ok(next >= value && next <= 1);
    value = next;
  }
  assert.equal(value, 1);
  const reverse = follow(.65, 0, 16);
  assert.ok(reverse > 0 && reverse < .65);
  assert.equal(smoothStep(-1), 0);
  assert.equal(smoothStep(2), 1);
});

test('all scenes have independent destinations and original highlights stay inside the source frame', () => {
  assert.equal(new Set(caseScenes.map(scene => scene.id)).size, caseScenes.length);
  for (const scene of caseScenes) {
    assert.ok(scene.afterScroll);
    assert.ok(scene.beforeScroll >= 0);
    assert.ok(scene.paragraphs.length > 0);
    for (const id of scene.before) {
      const r = beforeAnchors[id];
      assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.width <= 390 && r.y + r.height <= 1238);
    }
  }
  assert.equal(scrollDestination(9999, 848, 1238), 390);
  assert.equal(scrollDestination(-20, 848, 1238), 0);
});

test('an interrupted scene cannot overwrite a later destination; return to the beginning restores both screens', async () => {
  const original = { document: globalThis.document, matchMedia: globalThis.matchMedia, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
  const callbacks = new Map<number, FrameRequestCallback>();
  let id = 0;
  const node = (scrollHeight: number) => ({ style: { overflow: '' }, firstElementChild: { offsetHeight: scrollHeight, style: { transform: '', willChange: '' } }, scrollTop: 0, scrollHeight, clientHeight: 848, clientWidth: 390, getBoundingClientRect: () => ({ top: 0, width: 390 }), scrollTo({ top }: { top: number }) { this.scrollTop = top; } });
  const before = node(1238), after = node(2200);
  const stage = { dataset: {} };
  const target = { getBoundingClientRect: () => ({ top: 900 - after.scrollTop }) };
  let resets = 0;
  Object.assign(globalThis, {
    document: { querySelector: (selector: string) => selector === '.main-scroll' ? after : selector === '.before-scroll' ? before : selector === '.comparison-stage' ? stage : target },
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: (callback: FrameRequestCallback) => { callbacks.set(++id, callback); return id; },
    cancelAnimationFrame: (key: number) => callbacks.delete(key),
  });
  let clock = performance.now();
  const step = () => { clock += 16; const jobs = [...callbacks.values()]; callbacks.clear(); jobs.forEach(callback => callback(clock)); };
  const flush = () => { for (let i = 0; callbacks.size && i < 200; i++) step(); };
  try {
    const adapter = createCaseAdapter(() => resets++);
    const first = new AbortController();
    const pending = adapter.enter(caseScenes[3], first.signal, () => {});
    const rejected = assert.rejects(pending, { name: 'AbortError' });
    step(); step(); step();
    const inFlight = after.firstElementChild.style.transform;
    assert.notEqual(inFlight, 'translate3d(0,0px,0)');
    assert.equal(after.scrollTop, 0, 'animation must not write native scroll on each frame');
    first.abort();
    const latest = adapter.enter(caseScenes[6], new AbortController().signal, () => {});
    assert.equal(after.firstElementChild.style.transform, inFlight, 'retarget must keep the visible position');
    assert.equal(callbacks.size, 1, 'retarget reuses one animation clock');
    flush(); await latest; await rejected;
    assert.equal(before.scrollTop, 390);
    assert.equal(after.scrollTop, 1352);
    assert.equal(after.firstElementChild.style.transform, '');
    assert.equal(after.style.overflow, '');
    const back = adapter.enter(caseScenes[0], new AbortController().signal, () => {});
    flush(); await back;
    assert.equal(before.scrollTop, 0); assert.equal(after.scrollTop, 0);
    assert.equal(resets, 3); assert.equal(callbacks.size, 0);
    let drawn = 0;
    await adapter.enter(caseScenes[0], new AbortController().signal, () => drawn++);
    assert.equal(callbacks.size, 0, 'an unchanged destination must not start an idle animation clock');
    assert.equal(drawn, 1);
    const free = new AbortController();
    const travelling = adapter.enter(caseScenes[6], free.signal, () => {});
    const cancelled = assert.rejects(travelling, { name: 'AbortError' });
    step(); step(); step();
    free.abort(); await cancelled;
    assert.ok(after.scrollTop > 0 && after.scrollTop < 1352, 'free mode keeps the interrupted visual position');
    assert.equal(after.firstElementChild.style.transform, '');
    assert.equal(callbacks.size, 0, 'leaving the tour stops the screen animation clock');
  } finally { Object.assign(globalThis, original); }
});


test('screen motion keeps velocity across retargets and settles after a reversal', () => {
  let state = { position: 0, velocity: 0 };
  for (let i = 0; i < 8; i++) state = advancePosition(state, 900, 8);
  const forward = advancePosition(state, 1300, 8);
  assert.ok(forward.position > state.position && forward.velocity > 0);
  assert.ok(Math.abs(forward.velocity - state.velocity) < 900, 'new target must not restart from zero velocity');
  for (let i = 0; i < 200; i++) state = advancePosition(state, 0, 8);
  assert.deepEqual(state, { position: 0, velocity: 0 });
  assert.ok(advancePosition({ position: 0, velocity: 0 }, 1000, 250).position < 200, 'a missed frame must not jump across the screen');
});
