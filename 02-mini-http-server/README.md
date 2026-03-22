# mini-http-server

> A minimal HTTP/1.1 server in TypeScript using only Node.js `net`.

## What it implements

- TCP socket listening with `node:net`
- HTTP/1.1 request parsing for `GET`, `POST`, `PUT`, `DELETE`
- Router with `router.get()`, `router.post()`, `router.put()`, `router.delete()`
- `200`, `404`, `500` responses
- `Content-Type` helpers for `text/plain` and `application/json`
- Static file serving
- `demo.ts` integration tests over real TCP sockets

## Quick start

```bash
cd 02-mini-http-server
npm run demo
```

The demo starts the server, sends raw HTTP/1.1 requests over TCP, checks the responses, and shuts the server down.

## Project structure

```text
02-mini-http-server/
  src/
    server.ts
    router.ts
    request.ts
    response.ts
  public/
    hello.txt
    data.json
  demo.ts
  package.json
  tsconfig.json
  README.md
```

## How it works

1. `MiniHttpServer` listens for TCP connections with `net.createServer()`.
2. Incoming bytes accumulate until `\r\n\r\n` finishes the headers and `Content-Length` bytes finish the body.
3. `tryParseHttpRequest()` converts raw bytes into a typed request object.
4. `Router` matches `method + path` and returns a handler.
5. `HttpResponse` formats `HTTP/1.1` status line, headers, and body bytes.
6. `serveStatic()` maps a URL prefix like `/static` to a local directory.

## Demo endpoints

- `GET /` → plain text
- `GET /json` → JSON
- `POST /echo` → echoes request body
- `PUT /users` → updates a JSON payload
- `DELETE /users` → plain text delete response
- `GET /static/hello.txt` → static file

## Example

```ts
import { MiniHttpServer } from "./src/server.ts";
import { HttpResponse } from "./src/response.ts";

const server = new MiniHttpServer({ port: 8080 });

server.router.get("/", () => HttpResponse.text("hello"));
server.router.post("/api", (request) => HttpResponse.json({ body: request.text() }));
server.serveStatic("/static", "./public");

await server.listen();
```

## Not implemented

- Keep-alive and HTTP pipelining
- Chunked transfer encoding
- Middleware
- HTTPS/TLS
