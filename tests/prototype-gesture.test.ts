import assert from 'node:assert/strict';
import test from 'node:test';
import { dismissDistance, wheelDismissDistance, edgePull, elasticOffset, EdgePullGesture } from '../src/prototype-gesture.ts';

test('only outward vertical gestures starting at an edge can close the prototype', () => {
  assert.equal(edgePull(0, 900, 2, 100), 100);
  assert.equal(edgePull(900, 900, 2, -100), -100);
  assert.equal(edgePull(400, 900, 0, 1000), 0, 'arriving at an edge during a swipe cannot close it');
  assert.equal(edgePull(0, 900, 0, -100), 0, 'inward scroll stays native');
  assert.equal(edgePull(900, 900, 0, 100), 0);
  assert.equal(edgePull(0, 900, 120, 100), 0, 'horizontal gestures stay native');
  assert.ok(Math.abs(edgePull(0, 900, 0, 30)) < dismissDistance, 'short pulls spring back');
});

test('pulling is resistant, symmetric and bounded even with a large wheel impulse', () => {
  assert.equal(elasticOffset(0), 0);
  assert.ok(elasticOffset(200) > elasticOffset(100));
  assert.ok(elasticOffset(300) - elasticOffset(200) < elasticOffset(200) - elasticOffset(100));
  assert.equal(elasticOffset(-220), -elasticOffset(220));
  assert.ok(elasticOffset(10000) < 160);
});

test('both edges can be pulled back even after crossing the dismissal threshold', () => {
  for (const [start, sign] of [[0, 1], [900, -1]]) {
    const wheel = new EdgePullGesture(start, 900);
    wheel.push(sign * 260);
    assert.ok(wheel.canDismiss(wheelDismissDistance));
    wheel.push(-sign * 20);
    assert.ok(Math.abs(wheel.distance) > wheelDismissDistance);
    assert.equal(wheel.canDismiss(wheelDismissDistance), false, 'reversal cancels dismissal immediately');
    wheel.push(-sign * 600);
    assert.equal(wheel.distance, 0);
    assert.equal(wheel.claimed, false);
    wheel.push(sign * 500);
    assert.equal(wheel.distance, 0, 'rest of the gesture stays native after returning to rest');

    const touch = new EdgePullGesture(start, 900);
    touch.move(0, sign * 160);
    assert.ok(touch.canDismiss(dismissDistance));
    touch.move(0, sign * 140);
    assert.equal(touch.canDismiss(dismissDistance), false);
    touch.move(0, sign * 20);
    assert.equal(touch.canDismiss(dismissDistance), false);
  }
});

test('ordinary scrolling cannot arm a dismissal; short and high-resolution pulls return', () => {
  const middle = new EdgePullGesture(450, 900);
  middle.push(-1000);
  middle.push(-1000);
  assert.equal(middle.canDismiss(wheelDismissDistance), false);
  const inward = new EdgePullGesture(0, 900);
  inward.push(-100);
  inward.push(900);
  assert.equal(inward.distance, 0, 'reversing a native scroll must not start a pull');
  const small = new EdgePullGesture(0, 900);
  for (let i = 0; i < 50; i++) small.push(2);
  assert.equal(small.distance, 100, 'small trackpad deltas accumulate');
  assert.equal(small.canDismiss(wheelDismissDistance), false);
  const horizontal = new EdgePullGesture(0, 900);
  horizontal.move(50, 5);
  horizontal.move(50, 300);
  assert.equal(horizontal.distance, 0);
});
