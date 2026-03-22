export type Scope = "singleton" | "transient";
export type Token<T = unknown> = abstract new (...args: any[]) => T;
type DependencyList = Token[] | (() => Token[]);

type Provider<T = unknown> = {
  useClass: Token<T>;
  deps: DependencyList;
  scope: Scope;
};

type InjectableOptions = {
  deps?: DependencyList;
  scope?: Scope;
};

const injectableRegistry = new WeakMap<Token, Provider>();

export function Injectable(options: InjectableOptions = {}) {
  const deps = options.deps ?? [];
  const scope = options.scope ?? "singleton";
  return function <T extends Token>(value: T): void {
    injectableRegistry.set(value, { useClass: value, deps, scope });
  };
}

export class Container {
  private providers = new Map<Token, Provider>();
  private singletons = new Map<Token, unknown>();
  private resolving = new Set<Token>();

  register<T>(
    token: Token<T>,
    options: InjectableOptions & { useClass?: Token<T> } = {},
  ): this {
    const useClass = options.useClass ?? token;
    const meta = injectableRegistry.get(useClass);
    this.providers.set(token, {
      useClass,
      deps: options.deps ?? meta?.deps ?? [],
      scope: options.scope ?? meta?.scope ?? "singleton",
    });
    return this;
  }

  resolve<T>(token: Token<T>): T {
    const provider = this.getProvider(token);
    if (provider.scope === "singleton" && this.singletons.has(token)) {
      return this.singletons.get(token) as T;
    }
    if (this.resolving.has(token)) {
      throw new Error(`Circular dependency detected: ${token.name}`);
    }

    this.resolving.add(token);
    try {
      const args = this.getDeps(provider).map((dep) => this.resolve(dep));
      const instance = new provider.useClass(...args);
      if (provider.scope === "singleton") {
        this.singletons.set(token, instance);
      }
      return instance;
    } finally {
      this.resolving.delete(token);
    }
  }

  private getProvider<T>(token: Token<T>): Provider<T> {
    const existing = this.providers.get(token) as Provider<T> | undefined;
    if (existing) {
      return existing;
    }
    const meta = injectableRegistry.get(token);
    if (!meta) {
      throw new Error(`No provider registered for ${token.name}`);
    }
    this.providers.set(token, meta);
    return meta as Provider<T>;
  }

  private getDeps(provider: Provider): Token[] {
    return typeof provider.deps === "function" ? provider.deps() : provider.deps;
  }
}
