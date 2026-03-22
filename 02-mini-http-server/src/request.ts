import { URL } from "node:url";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export const SUPPORTED_METHODS: ReadonlySet<string> = new Set([
  "GET",
  "POST",
  "PUT",
  "DELETE",
]);

export interface HttpRequest {
  method: HttpMethod;
  path: string;
  rawPath: string;
  version: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: Buffer;
  text(): string;
  json<T = unknown>(): T;
}

export interface ParsedHttpRequest extends HttpRequest {
  headerBytes: number;
  contentLength: number;
}

export function tryParseHttpRequest(buffer: Buffer): ParsedHttpRequest | null {
  const separator = buffer.indexOf("\r\n\r\n");
  if (separator === -1) {
    return null;
  }

  const headerBytes = separator + 4;
  const head = buffer.subarray(0, separator).toString("utf8");
  const lines = head.split("\r\n");
  const requestLine = lines.shift();
  if (!requestLine) {
    throw new Error("Missing request line");
  }

  const [method, target, version] = requestLine.split(" ");
  if (!method || !target || !version) {
    throw new Error("Malformed request line");
  }
  if (!SUPPORTED_METHODS.has(method)) {
    throw new Error(`Unsupported method: ${method}`);
  }
  if (version !== "HTTP/1.1") {
    throw new Error(`Unsupported HTTP version: ${version}`);
  }

  const headers: Record<string, string> = {};
  for (const line of lines) {
    if (!line) {
      continue;
    }
    const index = line.indexOf(":");
    if (index === -1) {
      throw new Error(`Malformed header: ${line}`);
    }
    const key = line.slice(0, index).trim().toLowerCase();
    const value = line.slice(index + 1).trim();
    headers[key] = value;
  }

  const contentLengthHeader = headers["content-length"] ?? "0";
  const contentLength = Number.parseInt(contentLengthHeader, 10);
  if (!Number.isFinite(contentLength) || contentLength < 0) {
    throw new Error("Invalid Content-Length");
  }
  if (buffer.length < headerBytes + contentLength) {
    return null;
  }

  const body = buffer.subarray(headerBytes, headerBytes + contentLength);
  const url = new URL(target, "http://localhost");
  const query: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    query[key] = value;
  }

  return {
    method: method as HttpMethod,
    path: decodeURIComponent(url.pathname),
    rawPath: target,
    version,
    headers,
    query,
    body,
    headerBytes,
    contentLength,
    text() {
      return body.toString("utf8");
    },
    json<T = unknown>() {
      return JSON.parse(body.toString("utf8")) as T;
    },
  };
}
