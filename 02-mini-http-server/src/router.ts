import type { HttpMethod, HttpRequest } from "./request.ts";
import { HttpResponse } from "./response.ts";

export type RouteHandler = (request: HttpRequest) => HttpResponse | Promise<HttpResponse>;

interface RouteDefinition {
  method: HttpMethod;
  path: string;
  handler: RouteHandler;
}

export class Router {
  private readonly routes: RouteDefinition[] = [];

  add(method: HttpMethod, path: string, handler: RouteHandler): void {
    this.routes.push({ method, path, handler });
  }

  get(path: string, handler: RouteHandler): void {
    this.add("GET", path, handler);
  }

  post(path: string, handler: RouteHandler): void {
    this.add("POST", path, handler);
  }

  put(path: string, handler: RouteHandler): void {
    this.add("PUT", path, handler);
  }

  delete(path: string, handler: RouteHandler): void {
    this.add("DELETE", path, handler);
  }

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const route = this.routes.find((candidate) => {
      return candidate.method === request.method && candidate.path === request.path;
    });
    if (!route) {
      return HttpResponse.notFound();
    }
    return route.handler(request);
  }
}
