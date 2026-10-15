import assert from 'node:assert/strict';
import test from 'node:test';
import { blendRect, rectTransform, springProgress } from '../src/prototype-motion.ts';

test('fullscreen motion maps the live destination onto the exact source rectangle', () => {
  const small = { x: 360, y: 80, width: 240, height: 490 };
  const large = { x: 480, y: 16, width: 480, height: 980 };
  assert.equal(rectTransform(small, large), 'translate3d(-120px,64px,0) scale(0.5,0.5)');
  assert.equal(rectTransform(large, large), 'translate3d(0px,0px,0) scale(1,1)');
  assert.equal(rectTransform(large, small), 'translate3d(120px,-64px,0) scale(2,2)');
});

test('the release spring has no overshoot or long idle tail and ends at the exact box', () => {
  for (const duration of [180, 240, 420]) {
    const frames = springProgress(duration);
    assert.equal(frames[0].progress, 0);
    assert.equal(frames.at(-1)!.progress, 1);
    frames.forEach((frame, i) => {
      assert.ok(Number.isFinite(frame.progress));
      assert.ok(frame.progress >= 0 && frame.progress <= 1);
      if (i) assert.ok(frame.progress >= frames[i - 1].progress);
    });
    assert.ok(frames.find(frame => frame.offset >= .66)!.progress > .9, 'most of the return happens before the final third');
  }
  const small = { x: 360, y: 80, width: 240, height: 490 };
  const large = { x: 480, y: 16, width: 480, height: 980 };
  assert.deepEqual(blendRect(large, small, 0), large);
  assert.deepEqual(blendRect(large, small, 1), small);
});
