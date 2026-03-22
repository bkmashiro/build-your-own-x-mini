import test from "node:test";
import assert from "node:assert/strict";

import { computed, effect, reactive, ref } from "../src/index.ts";

test("reactive() tracks and re-runs effects for plain properties", () => {
  const state = reactive({ count: 0 });
  const seen: number[] = [];

  effect(() => {
    seen.push(state.count);
  });

  state.count = 1;
  state.count = 2;

  assert.deepEqual(seen, [0, 1, 2]);
});

test("reactive() supports nested objects", () => {
  const state = reactive({
    nested: {
      value: 1,
    },
  });

  let latest = 0;

  effect(() => {
    latest = state.nested.value;
  });

  state.nested.value = 5;

  assert.equal(latest, 5);
});

test("reactive() preserves proxy identity for nested objects", () => {
  const state = reactive({
    nested: {
      value: 1,
    },
  });

  assert.equal(state.nested, state.nested);
});

test("ref() wraps primitive values reactively", () => {
  const count = ref(1);
  let doubled = 0;

  effect(() => {
    doubled = count.value * 2;
  });

  count.value = 4;

  assert.equal(doubled, 8);
});

test("ref() makes object values reactive", () => {
  const user = ref({
    profile: {
      name: "Ada",
    },
  });

  let latest = "";

  effect(() => {
    latest = user.value.profile.name;
  });

  user.value.profile.name = "Grace";

  assert.equal(latest, "Grace");
});

test("computed() is lazy and cached until dependencies change", () => {
  const state = reactive({ count: 1 });
  let runs = 0;

  const doubled = computed(() => {
    runs += 1;
    return state.count * 2;
  });

  assert.equal(runs, 0);
  assert.equal(doubled.value, 2);
  assert.equal(doubled.value, 2);
  assert.equal(runs, 1);

  state.count = 3;

  assert.equal(runs, 1);
  assert.equal(doubled.value, 6);
  assert.equal(runs, 2);
});

test("computed() notifies effects when its dependencies change", () => {
  const price = ref(5);
  const quantity = ref(2);
  const total = computed(() => price.value * quantity.value);
  let observed = 0;

  effect(() => {
    observed = total.value;
  });

  quantity.value = 4;

  assert.equal(observed, 20);
});

test("effects track replaced nested objects", () => {
  const state = reactive({
    nested: {
      value: 1,
    },
  });

  let observed = 0;

  effect(() => {
    observed = state.nested.value;
  });

  state.nested = { value: 9 };

  assert.equal(observed, 9);
});

test("setting the same value does not trigger duplicate runs", () => {
  const state = reactive({ count: 1 });
  let runs = 0;

  effect(() => {
    runs += 1;
    void state.count;
  });

  state.count = 1;

  assert.equal(runs, 1);
});
