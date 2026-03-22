import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { MiniHttpServer } from "./src/server.ts";
import { HttpResponse } from "./src/response.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = 8899;

async function main(): Promise<void> {
  const server = new MiniHttpServer({ host: "127.0.0.1", port });

  server.router.get("/", () => HttpResponse.text("hello from mini-http-server"));
  server.router.get("/json", () => HttpResponse.json({ ok: true, project: "02-mini-http-server" }));
  server.router.post("/echo", (request) =>
    HttpResponse.json({
      method: request.method,
      contentType: request.headers["content-type"] ?? null,
      text: request.text(),
    }),
  );
  server.router.put("/users", (request) =>
    HttpResponse.json({
      action: "updated",
      payload: request.json<{ name: string }>(),
    }),
  );
  server.router.delete("/users", () => HttpResponse.text("deleted"));

  server.serveStatic("/static", path.join(__dirname, "public"));

  await server.listen();
  console.log(`mini-http-server demo listening on ${server.address()}`);

  try {
    await testGetText();
    await testGetJson();
    await testPostJson();
    await testPutJson();
    await testDelete();
    await testStaticFile();
    await testNotFound();
    console.log("All demo tests passed.");
  } finally {
    await server.close();
  }
}

async function testGetText(): Promise<void> {
  const response = await sendRawRequest("GET / HTTP/1.1\r\nHost: localhost\r\n\r\n");
  assertIncludes(response, "HTTP/1.1 200 OK");
  assertIncludes(response, "hello from mini-http-server");
  console.log("  ✓ GET /");
}

async function testGetJson(): Promise<void> {
  const response = await sendRawRequest("GET /json HTTP/1.1\r\nHost: localhost\r\n\r\n");
  assertIncludes(response, "Content-Type: application/json; charset=utf-8");
  assertIncludes(response, '"ok": true');
  console.log("  ✓ GET /json");
}

async function testPostJson(): Promise<void> {
  const body = JSON.stringify({ message: "hello" });
  const response = await sendRawRequest(
    [
      "POST /echo HTTP/1.1",
      "Host: localhost",
      "Content-Type: application/json",
      `Content-Length: ${Buffer.byteLength(body)}`,
      "",
      body,
    ].join("\r\n"),
  );
  assertIncludes(response, '"text": "{\\"message\\":\\"hello\\"}"');
  console.log("  ✓ POST /echo");
}

async function testPutJson(): Promise<void> {
  const body = JSON.stringify({ name: "alice" });
  const response = await sendRawRequest(
    [
      "PUT /users HTTP/1.1",
      "Host: localhost",
      "Content-Type: application/json",
      `Content-Length: ${Buffer.byteLength(body)}`,
      "",
      body,
    ].join("\r\n"),
  );
  assertIncludes(response, '"action": "updated"');
  assertIncludes(response, '"name": "alice"');
  console.log("  ✓ PUT /users");
}

async function testDelete(): Promise<void> {
  const response = await sendRawRequest("DELETE /users HTTP/1.1\r\nHost: localhost\r\n\r\n");
  assertIncludes(response, "deleted");
  console.log("  ✓ DELETE /users");
}

async function testStaticFile(): Promise<void> {
  const response = await sendRawRequest("GET /static/hello.txt HTTP/1.1\r\nHost: localhost\r\n\r\n");
  assertIncludes(response, "static hello");
  console.log("  ✓ GET /static/hello.txt");
}

async function testNotFound(): Promise<void> {
  const response = await sendRawRequest("GET /missing HTTP/1.1\r\nHost: localhost\r\n\r\n");
  assertIncludes(response, "HTTP/1.1 404 Not Found");
  console.log("  ✓ 404");
}

function sendRawRequest(rawRequest: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection({ host: "127.0.0.1", port }, () => {
      client.write(rawRequest);
    });
    const chunks: Buffer[] = [];

    client.on("data", (chunk) => {
      chunks.push(chunk);
    });
    client.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    client.on("error", reject);
  });
}

function assertIncludes(actual: string, expected: string): void {
  if (!actual.includes(expected)) {
    throw new Error(`Expected response to include ${JSON.stringify(expected)}.\nActual:\n${actual}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
