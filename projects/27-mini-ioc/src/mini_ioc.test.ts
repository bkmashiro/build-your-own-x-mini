import assert from "node:assert/strict";
import { test } from "node:test";

import { Container, createToken } from "./mini_ioc.ts";

interface Logger {
  log(message: string): void;
}

class MemoryLogger implements Logger {
  readonly messages: string[] = [];

  log(message: string): void {
    this.messages.push(message);
  }
}

class Service {
  readonly logger: Logger;
  readonly apiBaseUrl: string;

  constructor(logger: Logger, apiBaseUrl: string) {
    this.logger = logger;
    this.apiBaseUrl = apiBaseUrl;
  }
}

class DisposableService {
  disposed = 0;

  dispose(): void {
    this.disposed += 1;
  }
}

test("supports interface-style binding through typed tokens", () => {
  const LOGGER = createToken<Logger>("Logger");
  const API_BASE_URL = createToken<string>("ApiBaseUrl");
  const SERVICE = createToken<Service>("Service");

  const container = new Container();
  container.bind(LOGGER).toFactory(() => new MemoryLogger(), "singleton");
  container.bind(API_BASE_URL).toValue("https://api.example.com");
  container.bind(SERVICE).toClass(Service, [LOGGER, API_BASE_URL], "transient");

  const service = container.resolve(SERVICE);
  const logger = container.resolve(LOGGER) as MemoryLogger;

  service.logger.log("boot");

  assert.equal(service.apiBaseUrl, "https://api.example.com");
  assert.deepEqual(logger.messages, ["boot"]);
});

test("supports factories", () => {
  const COUNTER = createToken<number>("Counter");
  const NEXT_ID = createToken<string>("NextId");

  const container = new Container();
  let current = 0;

  container.bind(COUNTER).toValue(41);
  container.bind(NEXT_ID).toFactory((resolver) => {
    current = resolver.resolve(COUNTER);
    return `req-${current + 1}`;
  });

  assert.equal(container.resolve(NEXT_ID), "req-42");
});

test("supports singleton and transient lifetimes", () => {
  const SINGLETON = createToken<object>("Singleton");
  const TRANSIENT = createToken<object>("Transient");

  const container = new Container();
  container.bind(SINGLETON).toFactory(() => ({ id: Math.random() }), "singleton");
  container.bind(TRANSIENT).toFactory(() => ({ id: Math.random() }), "transient");

  assert.equal(container.resolve(SINGLETON), container.resolve(SINGLETON));
  assert.notEqual(container.resolve(TRANSIENT), container.resolve(TRANSIENT));
});

test("supports scoped lifetime", () => {
  const REQUEST_ID = createToken<object>("RequestId");

  const root = new Container();
  root.bind(REQUEST_ID).toFactory(() => ({ id: Math.random() }), "scoped");

  const scopeA = root.createScope();
  const scopeB = root.createScope();

  const a1 = scopeA.resolve(REQUEST_ID);
  const a2 = scopeA.resolve(REQUEST_ID);
  const b1 = scopeB.resolve(REQUEST_ID);

  assert.equal(a1, a2);
  assert.notEqual(a1, b1);
});

test("disposes scoped instances with the scope but keeps singletons alive until root dispose", () => {
  const SCOPED = createToken<DisposableService>("Scoped");
  const SINGLETON = createToken<DisposableService>("Singleton");

  const root = new Container();
  root.bind(SCOPED).toFactory(() => new DisposableService(), "scoped");
  root.bind(SINGLETON).toFactory(() => new DisposableService(), "singleton");

  const scope = root.createScope();
  const scoped = scope.resolve(SCOPED);
  const singleton = scope.resolve(SINGLETON);

  scope.dispose();
  assert.equal(scoped.disposed, 1);
  assert.equal(singleton.disposed, 0);

  root.dispose();
  assert.equal(singleton.disposed, 1);
});

test("throws for missing bindings and disposed containers", () => {
  const TOKEN = createToken<string>("Missing");
  const container = new Container();

  assert.throws(() => container.resolve(TOKEN), /No binding found/);

  container.dispose();
  assert.throws(() => container.bind(TOKEN), /disposed/);
});
