import { describe, expect, test } from "bun:test";

import { Container, Injectable } from "./mini_di";

@Injectable()
class Logger {
  entries: string[] = [];

  log(message: string): void {
    this.entries.push(message);
  }
}

@Injectable({ deps: [Logger] })
class UserService {
  constructor(readonly logger: Logger) {}

  createUser(name: string): string {
    this.logger.log(`created:${name}`);
    return name;
  }
}

@Injectable({ scope: "transient" })
class RequestId {
  value = Math.random();
}

@Injectable({ deps: [RequestId], scope: "transient" })
class RequestContext {
  constructor(readonly requestId: RequestId) {}
}

describe("mini-di", () => {
  test("resolves decorated classes without manual registration", () => {
    const container = new Container();
    const service = container.resolve(UserService);

    expect(service).toBeInstanceOf(UserService);
    expect(service.logger).toBeInstanceOf(Logger);
  });

  test("injects constructor dependencies", () => {
    const container = new Container();
    const service = container.resolve(UserService);

    expect(service.createUser("alice")).toBe("alice");
    expect(service.logger.entries).toEqual(["created:alice"]);
  });

  test("reuses singleton instances", () => {
    const container = new Container();
    const one = container.resolve(Logger);
    const two = container.resolve(Logger);

    expect(one).toBe(two);
  });

  test("creates new instances for transient scope", () => {
    const container = new Container();
    const one = container.resolve(RequestContext);
    const two = container.resolve(RequestContext);

    expect(one).not.toBe(two);
    expect(one.requestId).not.toBe(two.requestId);
  });

  test("allows overriding scope during registration", () => {
    const container = new Container();
    container.register(RequestId, { scope: "singleton" });

    const one = container.resolve(RequestId);
    const two = container.resolve(RequestId);

    expect(one).toBe(two);
  });

  test("throws when a provider is missing", () => {
    class MissingDep {}

    const container = new Container();
    expect(() => container.resolve(MissingDep)).toThrow(
      "No provider registered for MissingDep",
    );
  });

  test("throws on circular dependencies", () => {
    @Injectable({ deps: () => [Beta] })
    class Alpha {
      constructor(readonly beta: Beta) {}
    }

    @Injectable({ deps: [Alpha] })
    class Beta {
      constructor(readonly alpha: Alpha) {}
    }

    const container = new Container();
    expect(() => container.resolve(Alpha)).toThrow(
      "Circular dependency detected: Alpha",
    );
  });
});
