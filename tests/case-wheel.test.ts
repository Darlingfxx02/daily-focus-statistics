import assert from 'node:assert/strict';
import test from 'node:test';
import { CaseWheelMotion, wheelPixels } from '../src/case-wheel.ts';

test('mouse, line and page deltas preserve the intended scroll distance', () => {
  assert.equal(wheelPixels(150, 0, 800), 150);
  assert.equal(wheelPixels(3, 1, 800), 48);
  assert.equal(wheelPixels(-1, 2, 800), -800);
});

test('a burst of wheel notches produces one continuous trajectory, not 150 px jumps', () => {
  const motion = new CaseWheelMotion(2000);
  let previous = 2000;
  let largest = 0;
  for (let frame = 0; frame < 180; frame++) {
    if ([0, 3, 6, 9].includes(frame)) motion.push(150, 10000);
    const position = motion.step(8.33);
    largest = Math.max(largest, position - previous);
    assert.ok(position >= previous && position <= motion.target);
    previous = position;
  }
  assert.ok(largest < 40, `largest frame step ${largest}`);
  assert.equal(previous, 2600);
  assert.equal(motion.settled, true);
});

test('reversing discards queued forward distance and does not jump to the old target', () => {
  const motion = new CaseWheelMotion(2000);
  motion.push(1200, 10000);
  const position = motion.step(16);
  motion.push(-150, 10000);
  assert.equal(motion.target, position - 150);
  assert.ok(Math.abs(motion.step(8) - position) < 80);
  for (let i = 0; i < 150; i++) motion.step(16);
  assert.equal(motion.step(16), position - 150);
  assert.equal(motion.settled, true);
});

test('reduced motion settles immediately and page boundaries cannot be exceeded', () => {
  const motion = new CaseWheelMotion(30);
  motion.push(-150, 1000);
  assert.equal(motion.step(16, true), 0);
  assert.equal(motion.settled, true);
  motion.push(5000, 1000);
  for (let i = 0; i < 150; i++) assert.ok(motion.step(16) <= 1000);
  assert.equal(motion.step(16), 1000);
});
