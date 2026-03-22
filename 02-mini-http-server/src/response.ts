export interface ResponseInit {
  status?: number;
  headers?: Record<string, string>;
  body?: Buffer | string | object | null;
}

const STATUS_TEXT: Record<number, string> = {
  200: "OK",
  400: "Bad Request",
  404: "Not Found",
  405: "Method Not Allowed",
  500: "Internal Server Error",
};

export class HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: Buffer;

  constructor(init: ResponseInit = {}) {
    this.status = init.status ?? 200;
    this.headers = { ...(init.headers ?? {}) };
    this.body = normalizeBody(init.body ?? "");

    if (!this.headers["Content-Type"]) {
      this.headers["Content-Type"] = "text/plain; charset=utf-8";
    }
  }

  static text(body: string, status = 200): HttpResponse {
    return new HttpResponse({
      status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body,
    });
  }

  static json(body: object, status = 200): HttpResponse {
    return new HttpResponse({
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: Buffer.from(JSON.stringify(body, null, 2), "utf8"),
    });
  }

  static notFound(body = "404 Not Found"): HttpResponse {
    return HttpResponse.text(body, 404);
  }

  static internalError(body = "500 Internal Server Error"): HttpResponse {
    return HttpResponse.text(body, 500);
  }

  toBuffer(): Buffer {
    const reason = STATUS_TEXT[this.status] ?? "Unknown";
    const headers = {
      Date: new Date().toUTCString(),
      Connection: "close",
      "Content-Length": String(this.body.length),
      ...this.headers,
    };

    const headerLines = Object.entries(headers).map(([key, value]) => `${key}: ${value}`);
    const head = [`HTTP/1.1 ${this.status} ${reason}`, ...headerLines, "", ""].join("\r\n");
    return Buffer.concat([Buffer.from(head, "utf8"), this.body]);
  }
}

function normalizeBody(body: Buffer | string | object | null): Buffer {
  if (body === null) {
    return Buffer.alloc(0);
  }
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (typeof body === "string") {
    return Buffer.from(body, "utf8");
  }
  return Buffer.from(JSON.stringify(body, null, 2), "utf8");
}
