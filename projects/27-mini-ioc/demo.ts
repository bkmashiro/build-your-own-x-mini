import { Container, createToken } from "./src/mini_ioc.ts";

interface Logger {
  log(message: string): void;
}

class ConsoleLogger implements Logger {
  log(message: string): void {
    console.log(`[log] ${message}`);
  }
}

class UserRepository {
  private readonly logger: Logger;
  private readonly requestId: string;

  constructor(logger: Logger, requestId: string) {
    this.logger = logger;
    this.requestId = requestId;
  }

  findAll(): string[] {
    this.logger.log(`fetch users for ${this.requestId}`);
    return ["alice", "bob", "carol"];
  }
}

const LOGGER = createToken<Logger>("Logger");
const REQUEST_ID = createToken<string>("RequestId");
const USER_REPOSITORY = createToken<UserRepository>("UserRepository");

const root = new Container();
root.bind(LOGGER).toClass(ConsoleLogger, [], "singleton");
root.bind(REQUEST_ID).toFactory(() => `req-${Math.random().toString(16).slice(2, 8)}`, "scoped");
root.bind(USER_REPOSITORY).toClass(UserRepository, [LOGGER, REQUEST_ID], "scoped");

const requestScope = root.createScope();
const repository = requestScope.resolve(USER_REPOSITORY);

console.log(repository.findAll());

requestScope.dispose();
root.dispose();
