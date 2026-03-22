import test from "node:test";
import assert from "node:assert/strict";

import {
  batch,
  createEffect,
  createMemo,
  createSignal,
} from "../src/index.ts";

test("createSignal reads and writes values", () => {
  const [count, setCount] = createSignal(1);

  assert.equal(count(), 1);
  assert.equal(setCount(2), 2);
  assert.equal(count(), 2);
  assert.equal(setCount((value) => value + 3), 5);
  assert.equal(count(), 5);
});

test("createEffect reruns when tracked dependencies change", () => {
  const [count, setCount] = createSignal(0);
  const seen: number[] = [];

  createEffect(() => {
    seen.push(count());
  });

  setCount(1);
  setCount(2);

  assert.deepEqual(seen, [0, 1, 2]);
});

test("effects clean up stale dependencies during branch switches", () => {
  const [enabled, setEnabled] = createSignal(true);
  const [left, setLeft] = createSignal(1);
  const [right, setRight] = createSignal(10);
  const seen: number[] = [];

  createEffect(() => {
    seen.push(enabled() ? left() : right());
  });

  setLeft(2);
  setEnabled(false);
  setLeft(3);
  setRight(11);

  assert.deepEqual(seen, [1, 2, 10, 11]);
});

test("createMemo caches derived values and only notifies dependents on change", () => {
  const [count, setCount] = createSignal(1);
  let memoRuns = 0;
  const parity = createMemo(() => {
    memoRuns += 1;
    return count() % 2;
  });

  const seen: number[] = [];
  createEffect(() => {
    seen.push(parity());
  });

  setCount(3);
  setCount(5);
  setCount(6);

  assert.equal(memoRuns, 4);
  assert.deepEqual(seen, [1, 0]);
});

test("batch coalesces updates into a single effect flush", () => {
  const [count, setCount] = createSignal(0);
  const [label, setLabel] = createSignal("zero");
  const seen: Array<[number, string]> = [];

  createEffect(() => {
    seen.push([count(), label()]);
  });

  batch(() => {
    setCount(1);
    setLabel("one");
    setCount(2);
  });

  assert.deepEqual(seen, [
    [0, "zero"],
    [2, "one"],
  ]);
});

test("nested batch still flushes once at the outer boundary", () => {
  const [count, setCount] = createSignal(0);
  const seen: number[] = [];

  createEffect(() => {
    seen.push(count());
  });

  batch(() => {
    setCount(1);
    batch(() => {
      setCount(2);
      setCount(3);
    });
    setCount(4);
  });

  assert.deepEqual(seen, [0, 4]);
});
