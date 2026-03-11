# 03 — mini-http

> A minimal HTTP/1.1 server in pure Python — ~190 lines.

## What we build

A working HTTP/1.1 server with routing, path parameters, and JSON/HTML/text responses — using only `socket` and `threading`.

## How HTTP/1.1 works

### Request format

```
GET /users/42?verbose=true HTTP/1.1\r\n
Host: localhost:8080\r\n
Content-Type: application/json\r\n
\r\n
<optional body>
```

- **Request line**: `METHOD /path HTTP/1.1` — the method (GET, POST, ...), the resource path, and the protocol version
- **Headers**: `Key: Value` pairs, one per line — metadata about the request
- **Blank line** (`\r\n\r\n`): separates headers from body
- **Body**: optional, length indicated by `Content-Length` header

### Response format

```
HTTP/1.1 200 OK\r\n
Content-Type: text/plain\r\n
Content-Length: 5\r\n
\r\n
hello
```

Same structure: status line, headers, blank line, body.

### Connection handling

1. Server binds a TCP socket and listens
2. `accept()` returns a new socket for each client
3. Read raw bytes → parse HTTP request → route to handler → format HTTP response → send
4. Each connection runs in a separate thread

### Path parameters

Routes like `/users/:id` compile to regex `/users/(?P<id>[^/]+)`. On match, captured groups become `req.params`.

## Usage

```bash
python demo.py
```

Then in another terminal:

```bash
# GET request
curl http://localhost:8888/
curl http://localhost:8888/users/42
curl http://localhost:8888/hello?name=World

# POST with body
curl -X POST http://localhost:8888/echo -d "hello from curl"
```

### As a library

```python
from mini_http import MiniHTTP, Response

app = MiniHTTP(port=8080)

@app.get("/")
def index(req):
    return Response.html("<h1>Hello</h1>")

@app.get("/users/:id")
def get_user(req):
    return Response.json({"id": req.params["id"]})

@app.post("/echo")
def echo(req):
    return Response.json({"body": req.body.decode()})

app.run()
```

## What we skip

- TLS/HTTPS (would need `ssl` module)
- HTTP/2, HTTP/3
- Chunked transfer encoding
- Keep-alive (we close after each response)
- Static file serving
- Middleware / error handlers
- Cookie parsing

---

## 中文摘要

mini-http 用 ~190 行 Python 实现了一个 HTTP/1.1 服务器。

**核心概念：**
- **HTTP 报文解析**：请求行（方法 + 路径 + 版本）、头部（key: value）、空行、正文
- **Socket API**：bind → listen → accept → recv/send，每个连接一个线程
- **路由匹配**：`/users/:id` 编译为正则，捕获路径参数到 `req.params`
- **响应构建**：状态行 + 头部 + 正文，自动设置 Content-Length

**和真实 HTTP 服务器的差距：** 没有 TLS、没有 HTTP/2、没有 chunked 编码、没有 Keep-Alive。但请求解析和响应格式化的核心逻辑完全一致。
