export type InjectionToken<T> = symbol & { readonly __type?: T };

export type Constructor<T> = new (...args: any[]) => T;

export type Lifetime = "singleton" | "transient" | "scoped";

export interface Resolver {
  resolve<T>(token: InjectionToken<T>): T;
}

type Factory<T> = (resolver: Resolver) => T;

type Definition<T> =
  | { kind: "value"; value: T }
  | { kind: "class"; ctor: Constructor<T>; deps: InjectionToken<unknown>[] }
  | { kind: "factory"; factory: Factory<T> };

interface Binding<T> {
  lifetime: Lifetime;
  definition: Definition<T>;
}

interface DisposableLike {
  dispose?: () => void;
  [Symbol.dispose]?: () => void;
}

interface DisposalRecord {
  value: unknown;
  dispose: () => void;
}

function isDisposable(value: unknown): value is DisposableLike {
  return Boolean(
    value &&
      typeof value === "object" &&
      (typeof (value as DisposableLike).dispose === "function" ||
        typeof (value as DisposableLike)[Symbol.dispose] === "function"),
  );
}

function toDisposalRecord(value: unknown): DisposalRecord | null {
  if (!isDisposable(value)) {
    return null;
  }

  const disposable = value;
  return {
    value,
    dispose: () => {
      if (typeof disposable[Symbol.dispose] === "function") {
        disposable[Symbol.dispose]();
        return;
      }
      disposable.dispose?.();
    },
  };
}

function defaultLifetimeFor<T>(definition: Definition<T>): Lifetime {
  return definition.kind === "value" ? "singleton" : "transient";
}

export function createToken<T>(description: string): InjectionToken<T> {
  return Symbol(description) as InjectionToken<T>;
}

class Binder<T> {
  private readonly container: Container;
  private readonly token: InjectionToken<T>;

  constructor(container: Container, token: InjectionToken<T>) {
    this.container = container;
    this.token = token;
  }

  toValue(value: T): void {
    this.container.register(this.token, {
      lifetime: "singleton",
      definition: { kind: "value", value },
    });
  }

  toClass(
    ctor: Constructor<T>,
    deps: InjectionToken<unknown>[] = [],
    lifetime: Lifetime = "transient",
  ): void {
    this.container.register(this.token, {
      lifetime,
      definition: { kind: "class", ctor, deps },
    });
  }

  toFactory(factory: Factory<T>, lifetime: Lifetime = "transient"): void {
    this.container.register(this.token, {
      lifetime,
      definition: { kind: "factory", factory },
    });
  }
}

export class Container implements Resolver {
  private readonly bindings = new Map<InjectionToken<unknown>, Binding<unknown>>();
  private readonly singletons: Map<InjectionToken<unknown>, unknown>;
  private readonly scopedInstances = new Map<InjectionToken<unknown>, unknown>();
  private readonly disposalRecords: DisposalRecord[] = [];
  private readonly tracked = new WeakSet<object>();
  private readonly parent?: Container;
  private disposed = false;

  constructor(parent?: Container, singletons?: Map<InjectionToken<unknown>, unknown>) {
    this.parent = parent;
    this.singletons = singletons ?? new Map();
  }

  bind<T>(token: InjectionToken<T>): Binder<T> {
    this.ensureActive();
    return new Binder(this, token);
  }

  createScope(): Container {
    this.ensureActive();
    return new Container(this, this.singletons);
  }

  resolve<T>(token: InjectionToken<T>): T {
    this.ensureActive();
    const binding = this.lookupBinding(token);
    if (!binding) {
      throw new Error(`No binding found for token ${String(token.description ?? token)}`);
    }

    if (binding.lifetime === "singleton") {
      const owner = this.root();
      return this.resolveCached(token, owner.singletons, owner, () => this.instantiate(binding));
    }

    if (binding.lifetime === "scoped") {
      return this.resolveCached(token, this.scopedInstances, this, () => this.instantiate(binding));
    }

    return this.instantiate(binding);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    for (let i = this.disposalRecords.length - 1; i >= 0; i -= 1) {
      this.disposalRecords[i].dispose();
    }

    this.disposalRecords.length = 0;
    this.scopedInstances.clear();

    if (!this.parent) {
      this.singletons.clear();
    }
  }

  register<T>(token: InjectionToken<T>, binding: Binding<T>): void {
    this.bindings.set(token, binding as Binding<unknown>);
  }

  private resolveCached<T>(
    token: InjectionToken<T>,
    cache: Map<InjectionToken<unknown>, unknown>,
    owner: Container,
    factory: () => T,
  ): T {
    if (cache.has(token)) {
      return cache.get(token) as T;
    }

    const value = factory();
    cache.set(token, value);
    owner.trackDisposable(value);
    return value;
  }

  private instantiate<T>(binding: Binding<T>): T {
    const value = this.instantiateDefinition(binding.definition);
    if (binding.lifetime === "transient") {
      this.trackDisposable(value);
    }
    return value;
  }

  private instantiateDefinition<T>(definition: Definition<T>): T {
    if (definition.kind === "value") {
      return definition.value;
    }

    if (definition.kind === "factory") {
      return definition.factory(this);
    }

    const deps = definition.deps.map((token) => this.resolve(token));
    return new definition.ctor(...deps);
  }

  private lookupBinding<T>(token: InjectionToken<T>): Binding<T> | undefined {
    const own = this.bindings.get(token);
    if (own) {
      return own as Binding<T>;
    }
    return this.parent?.lookupBinding(token);
  }

  private root(): Container {
    return this.parent ? this.parent.root() : this;
  }

  private trackDisposable(value: unknown): void {
    if (!value || typeof value !== "object") {
      return;
    }

    if (this.tracked.has(value)) {
      return;
    }

    const record = toDisposalRecord(value);
    if (!record) {
      return;
    }

    this.tracked.add(value);
    this.disposalRecords.push(record);
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error("Container has been disposed");
    }
  }
}

export function bindValue<T>(token: InjectionToken<T>, value: T): [InjectionToken<T>, Binding<T>] {
  return [
    token,
    {
      lifetime: defaultLifetimeFor({ kind: "value", value }),
      definition: { kind: "value", value },
    },
  ];
}
