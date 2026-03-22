type EffectScheduler = () => void;

type Dep = Set<ReactiveEffect>;
type KeyToDepMap = Map<PropertyKey, Dep>;
type TargetMap = WeakMap<object, KeyToDepMap>;

export type EffectFn = (() => void) & { effect?: ReactiveEffect };

class ReactiveEffect {
  public deps: Dep[] = [];
  public readonly fn: () => unknown;
  public readonly scheduler?: EffectScheduler;

  constructor(fn: () => unknown, scheduler?: EffectScheduler) {
    this.fn = fn;
    this.scheduler = scheduler;
  }

  run(): unknown {
    cleanupEffect(this);
    effectStack.push(this);
    activeEffect = this;

    try {
      return this.fn();
    } finally {
      effectStack.pop();
      activeEffect = effectStack[effectStack.length - 1];
    }
  }
}

const targetMap: TargetMap = new WeakMap();
const reactiveCache = new WeakMap<object, object>();
const refDepMap: TargetMap = new WeakMap();
const effectStack: ReactiveEffect[] = [];

let activeEffect: ReactiveEffect | undefined;

function cleanupEffect(effect: ReactiveEffect): void {
  for (const dep of effect.deps) {
    dep.delete(effect);
  }

  effect.deps.length = 0;
}

function track(target: object, key: PropertyKey, depsMapStore: TargetMap = targetMap): void {
  if (!activeEffect) {
    return;
  }

  let depsMap = depsMapStore.get(target);
  if (!depsMap) {
    depsMap = new Map();
    depsMapStore.set(target, depsMap);
  }

  let dep = depsMap.get(key);
  if (!dep) {
    dep = new Set();
    depsMap.set(key, dep);
  }

  if (dep.has(activeEffect)) {
    return;
  }

  dep.add(activeEffect);
  activeEffect.deps.push(dep);
}

function trigger(target: object, key: PropertyKey, depsMapStore: TargetMap = targetMap): void {
  const depsMap = depsMapStore.get(target);
  const dep = depsMap?.get(key);
  if (!dep) {
    return;
  }

  const effectsToRun = new Set(dep);
  for (const effect of effectsToRun) {
    if (effect === activeEffect) {
      continue;
    }

    if (effect.scheduler) {
      effect.scheduler();
    } else {
      effect.run();
    }
  }
}

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

function toReactive<T>(value: T): T {
  return isObject(value) ? (reactive(value) as T) : value;
}

export function reactive<T extends object>(target: T): T {
  if (!isObject(target)) {
    throw new TypeError("reactive() expects an object");
  }

  const cached = reactiveCache.get(target);
  if (cached) {
    return cached as T;
  }

  const proxy = new Proxy(target, {
    get(obj, key, receiver) {
      track(obj, key);
      const result = Reflect.get(obj, key, receiver);
      return toReactive(result);
    },
    set(obj, key, value, receiver) {
      const oldValue = Reflect.get(obj, key, receiver);
      const changed = !Object.is(oldValue, value);
      const didSet = Reflect.set(obj, key, value, receiver);

      if (didSet && changed) {
        trigger(obj, key);
      }

      return didSet;
    },
  });

  reactiveCache.set(target, proxy);
  return proxy;
}

export interface Ref<T> {
  value: T;
}

class RefImpl<T> implements Ref<T> {
  private _value: T;

  constructor(value: T) {
    this._value = toReactive(value);
  }

  get value(): T {
    track(this, "value", refDepMap);
    return this._value;
  }

  set value(nextValue: T) {
    if (Object.is(this._value, nextValue)) {
      return;
    }

    this._value = toReactive(nextValue);
    trigger(this, "value", refDepMap);
  }
}

export function ref<T>(value: T): Ref<T> {
  return new RefImpl(value);
}

export function effect(fn: () => void): EffectFn {
  const reactiveEffect = new ReactiveEffect(fn);
  const runner = reactiveEffect.run.bind(reactiveEffect) as EffectFn;
  runner.effect = reactiveEffect;
  runner();
  return runner;
}

export interface ComputedRef<T> {
  readonly value: T;
}

class ComputedRefImpl<T> implements ComputedRef<T> {
  private dirty = true;
  private cachedValue!: T;
  private readonly runner: ReactiveEffect;

  constructor(getter: () => T) {
    this.runner = new ReactiveEffect(getter, () => {
      if (!this.dirty) {
        this.dirty = true;
        trigger(this, "value", refDepMap);
      }
    });
  }

  get value(): T {
    track(this, "value", refDepMap);

    if (this.dirty) {
      this.dirty = false;
      this.cachedValue = this.runner.run() as T;
    }

    return this.cachedValue;
  }
}

export function computed<T>(getter: () => T): ComputedRef<T> {
  return new ComputedRefImpl(getter);
}
