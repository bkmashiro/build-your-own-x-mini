export type Accessor<T> = () => T;
export type Setter<T> = (next: T | ((prev: T) => T)) => T;

type Source = {
  observers: Set<Computation<unknown>>;
};

type Computation<T> = Source & {
  fn: () => T;
  kind: "effect" | "memo";
  sources: Set<Source>;
  value: T;
  queued: boolean;
};

let currentComputation: Computation<unknown> | null = null;
let batchDepth = 0;
const queue = new Set<Computation<unknown>>();

function cleanupSources(computation: Computation<unknown>): void {
  for (const source of computation.sources) {
    source.observers.delete(computation);
  }
  computation.sources.clear();
}

function track(source: Source): void {
  if (!currentComputation) {
    return;
  }
  if (currentComputation.sources.has(source)) {
    return;
  }
  currentComputation.sources.add(source);
  source.observers.add(currentComputation);
}

function runComputation<T>(computation: Computation<T>): T {
  cleanupSources(computation);
  const previous = currentComputation;
  currentComputation = computation;
  try {
    computation.value = computation.fn();
    return computation.value;
  } finally {
    currentComputation = previous;
  }
}

function enqueue(computation: Computation<unknown>): void {
  if (computation.queued) {
    return;
  }
  computation.queued = true;
  queue.add(computation);
}

function notify(source: Source): void {
  for (const observer of source.observers) {
    enqueue(observer);
  }
  if (batchDepth === 0) {
    flushQueue();
  }
}

function flushQueue(): void {
  while (queue.size > 0) {
    const pending = [...queue];
    queue.clear();

    for (const computation of pending) {
      computation.queued = false;
      if (computation.kind === "memo") {
        const previous = computation.value;
        const next = runComputation(computation);
        if (!Object.is(previous, next)) {
          notify(computation);
        }
        continue;
      }
      runComputation(computation);
    }
  }
}

export function batch<T>(fn: () => T): T {
  batchDepth += 1;
  try {
    return fn();
  } finally {
    batchDepth -= 1;
    if (batchDepth === 0) {
      flushQueue();
    }
  }
}

export function createSignal<T>(initial: T): [Accessor<T>, Setter<T>] {
  const signal: Source & { value: T } = {
    value: initial,
    observers: new Set(),
  };

  const read: Accessor<T> = () => {
    track(signal);
    return signal.value;
  };

  const write: Setter<T> = (next) => {
    const value = typeof next === "function"
      ? (next as (prev: T) => T)(signal.value)
      : next;

    if (Object.is(signal.value, value)) {
      return signal.value;
    }

    signal.value = value;
    notify(signal);
    return signal.value;
  };

  return [read, write];
}

export function createEffect(fn: () => void): void {
  const computation: Computation<void> = {
    fn,
    kind: "effect",
    sources: new Set(),
    observers: new Set(),
    value: undefined,
    queued: false,
  };

  runComputation(computation);
}

export function createMemo<T>(fn: () => T): Accessor<T> {
  const computation: Computation<T> = {
    fn,
    kind: "memo",
    sources: new Set(),
    observers: new Set(),
    value: undefined as T,
    queued: false,
  };

  runComputation(computation);

  return () => {
    track(computation);
    return computation.value;
  };
}
