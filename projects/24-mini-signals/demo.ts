import { batch, createEffect, createMemo, createSignal } from "./src/index.ts";

const [count, setCount] = createSignal(1);
const [name, setName] = createSignal("signals");

const summary = createMemo(() => `${name()} => ${count() * 2}`);

createEffect(() => {
  console.log("effect:", summary());
});

batch(() => {
  setCount(2);
  setName("solid-style");
  setCount(3);
});
