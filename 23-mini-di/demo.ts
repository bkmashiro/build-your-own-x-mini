import { Container, Injectable } from "./src";

@Injectable()
class Config {
  mode = "demo";
}

@Injectable({ deps: [Config] })
class Greeter {
  constructor(private readonly config: Config) {}

  greet(name: string): string {
    return `[${this.config.mode}] hello, ${name}`;
  }
}

@Injectable({ scope: "transient" })
class RequestId {
  value = crypto.randomUUID().slice(0, 8);
}

const container = new Container();
const greeter = container.resolve(Greeter);
const idA = container.resolve(RequestId);
const idB = container.resolve(RequestId);

console.log(greeter.greet("mini-di"));
console.log("transient ids:", idA.value, idB.value);
