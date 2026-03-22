import net from "node:net";
import fs from "node:fs/promises";
import path from "node:path";

import { Router } from "./router.ts";
import { tryParseHttpRequest } from "./request.ts";
import { HttpResponse } from "./response.ts";

interface StaticMount {
  urlPrefix: string;
  rootDir: string;
}

export interface MiniHttpServerOptions {
  host?: string;
  port?: number;
}

export class MiniHttpServer {
  readonly host: string;
  readonly port: number;
  readonly router: Router;

  private readonly server: net.Server;
  private readonly staticMounts: StaticMount[] = [];

  constructor(options: MiniHttpServerOptions = {}) {
    this.host = options.host ?? "127.0.0.1";
    this.port = options.port ?? 8080;
    this.router = new Router();
    this.server = net.createServer((socket) => {
      void this.handleConnection(socket);
    });
  }

  serveStatic(urlPrefix: string, rootDir: string): void {
    const normalizedPrefix = normalizePrefix(urlPrefix);
    this.staticMounts.push({ urlPrefix: normalizedPrefix, rootDir });
  }

  async listen(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        this.server.off("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        this.server.off("error", onError);
        resolve();
      };
      this.server.once("error", onError);
      this.server.once("listening", onListening);
      this.server.listen(this.port, this.host);
    });
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  address(): string {
    return `http://${this.host}:${this.port}`;
  }

  private async handleConnection(socket: net.Socket): Promise<void> {
    socket.setTimeout(5000);
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    try {
      const request = await new Promise<ReturnType<typeof tryParseHttpRequest>>((resolve, reject) => {
        const finalize = (value: ReturnType<typeof tryParseHttpRequest>) => {
          cleanup();
          resolve(value);
        };
        const fail = (error: Error) => {
          cleanup();
          reject(error);
        };
        const cleanup = () => {
          socket.off("data", onData);
          socket.off("end", onEnd);
          socket.off("error", onError);
          socket.off("timeout", onTimeout);
        };
        const onData = (chunk: Buffer) => {
          chunks.push(chunk);
          totalBytes += chunk.length;
          if (totalBytes > 1024 * 1024) {
            fail(new Error("400 Request too large"));
            return;
          }
          try {
            const parsed = tryParseHttpRequest(Buffer.concat(chunks, totalBytes));
            if (parsed) {
              finalize(parsed);
            }
          } catch (error) {
            fail(error instanceof Error ? error : new Error("400 Malformed request"));
          }
        };
        const onEnd = () => {
          try {
            finalize(tryParseHttpRequest(Buffer.concat(chunks, totalBytes)));
          } catch (error) {
            fail(error instanceof Error ? error : new Error("400 Malformed request"));
          }
        };
        const onError = (error: Error) => fail(error);
        const onTimeout = () => fail(new Error("Socket timeout"));

        socket.on("data", onData);
        socket.once("end", onEnd);
        socket.once("error", onError);
        socket.once("timeout", onTimeout);
      });

      let response: HttpResponse;
      if (!request) {
        response = HttpResponse.text("400 Bad Request", 400);
      } else {
        response = (await this.tryServeStatic(request.path)) ?? (await this.dispatch(request));
      }
      socket.write(response.toBuffer());
    } catch (error) {
      const message = error instanceof Error ? error.message : "500 Internal Server Error";
      const isClientError = message.startsWith("400 ") || message.startsWith("Unsupported ");
      socket.write(
        (isClientError ? HttpResponse.text("400 Bad Request", 400) : HttpResponse.internalError()).toBuffer(),
      );
    } finally {
      socket.end();
    }
  }

  private async dispatch(request: NonNullable<ReturnType<typeof tryParseHttpRequest>>): Promise<HttpResponse> {
    try {
      return await this.router.handle(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : "500 Internal Server Error";
      return HttpResponse.text(`500 Internal Server Error\n${message}`, 500);
    }
  }

  private async tryServeStatic(requestPath: string): Promise<HttpResponse | null> {
    for (const mount of this.staticMounts) {
      if (!requestPath.startsWith(mount.urlPrefix)) {
        continue;
      }

      const relativePath = requestPath.slice(mount.urlPrefix.length).replace(/^\/+/, "");
      const safePath = relativePath || "index.txt";
      const absolutePath = path.resolve(mount.rootDir, safePath);
      const rootDir = path.resolve(mount.rootDir);
      const relativeToRoot = path.relative(rootDir, absolutePath);
      if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
        return HttpResponse.notFound();
      }

      try {
        const body = await fs.readFile(absolutePath);
        return new HttpResponse({
          status: 200,
          headers: { "Content-Type": contentTypeForFile(absolutePath) },
          body,
        });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return HttpResponse.notFound();
        }
        throw error;
      }
    }
    return null;
  }
}

function normalizePrefix(prefix: string): string {
  if (!prefix.startsWith("/")) {
    return `/${prefix}`;
  }
  return prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
}

function contentTypeForFile(filename: string): string {
  const extension = path.extname(filename).toLowerCase();
  switch (extension) {
    case ".json":
      return "application/json; charset=utf-8";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}
