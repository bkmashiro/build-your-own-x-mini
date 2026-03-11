# 03 — mini-http 最小 HTTP/1.1 服务器

[English](README.md)

> 用纯 Python 实现的 HTTP/1.1 服务器，~190 行代码，只依赖标准库 `socket` 和 `threading`，带路由、路径参数和 JSON 响应。

---

## 背景与动机

Flask、FastAPI、Express 这些 Web 框架让开发 HTTP 服务变得极其简单，但也彻底隐藏了底层细节。"HTTP 请求到底是什么？服务器是怎么解析它的？路由匹配是怎么工作的？"

这个项目的目标是：**从原始 TCP socket 出发，一步步构建一个真正可用的 HTTP/1.1 服务器**，不使用 Python 的 `http.server`、`socketserver` 或任何 Web 框架。

最终实现的 API 设计刻意仿照 Flask 的装饰器风格，让人直观感受到框架本质上在做什么。

---

## 核心架构

```
┌──────────────────────────────────────────┐
│            MiniHTTP (Server)             │  ← 顶层：生命周期 + 线程管理
├──────────────────────────────────────────┤
│               Router                     │  ← 路由：METHOD + path → handler
├──────────────────────────────────────────┤
│         Request / Response               │  ← 数据模型：解析 + 格式化
├──────────────────────────────────────────┤
│          Raw TCP Socket                  │  ← 网络层：字节读写
└──────────────────────────────────────────┘
```

一次请求的完整生命周期：

```
客户端 TCP 连接
    → _recv_request()     读取原始字节，处理分包
    → _parse_request()    解析 HTTP 报文 → Request 对象
    → router.match()      找到对应的 handler
    → handler(req)        业务逻辑 → Response 对象
    → _format_response()  序列化 → HTTP 响应字节
    → socket.sendall()    发送，关闭连接
```

---

## 关键实现

### HTTP 报文格式

HTTP/1.1 是一个基于文本的协议，请求和响应的格式是固定的：

**请求：**
```
GET /users/42?verbose=true HTTP/1.1\r\n
Host: localhost:8080\r\n
Content-Type: application/json\r\n
\r\n
<可选 body>
```

**响应：**
```
HTTP/1.1 200 OK\r\n
Content-Type: text/plain\r\n
Content-Length: 5\r\n
\r\n
hello
```

关键细节：
- 行与行之间用 `\r\n`（CRLF），不是单独的 `\n`
- 头部与 body 之间用一个空行（即 `\r\n\r\n`）
- body 的长度由 `Content-Length` 头部指定（不读这个就不知道什么时候停止读取）

### TCP 读取与分包处理

TCP 是流式协议，数据可能分多个包到达。`_recv_request` 需要处理两个阶段：

1. **读头部**：一直读到遇到 `\r\n\r\n`
2. **读 body**：根据 `Content-Length` 读剩余字节

```python
def _recv_request(self, conn: socket.socket) -> bytes:
    conn.settimeout(5.0)
    buf = b""
    # 阶段一：读到头部结束标志
    while b"\r\n\r\n" not in buf:
        chunk = conn.recv(4096)
        if not chunk:
            return b""
        buf += chunk
    # 阶段二：检查 Content-Length，读完 body
    header_end = buf.index(b"\r\n\r\n") + 4
    headers_raw = buf[:header_end].decode(errors="replace").lower()
    content_length = 0
    for line in headers_raw.split("\r\n"):
        if line.startswith("content-length:"):
            content_length = int(line.split(":", 1)[1].strip())
            break
    body_so_far = len(buf) - header_end
    while body_so_far < content_length:
        chunk = conn.recv(4096)
        if not chunk:
            break
        buf += chunk
        body_so_far += len(chunk)
    return buf
```

这里有一个容易忽略的 bug 点：第一次 `recv` 可能已经读到了部分 body（TCP 数据和头部一起到达），所以 `body_so_far = len(buf) - header_end` 而不是 0。

### HTTP 请求解析

解析器把原始字节拆解成结构化的 `Request` 对象：

```python
def _parse_request(self, raw: bytes) -> Request:
    req = Request()
    header_end = raw.index(b"\r\n\r\n")
    header_section = raw[:header_end].decode(errors="replace")
    req.body = raw[header_end + 4:]

    lines = header_section.split("\r\n")
    # 第一行：请求行
    request_line = lines[0]
    parts = request_line.split(" ", 2)
    req.method = parts[0].upper()       # GET, POST, ...
    full_path = parts[1] if len(parts) > 1 else "/"

    # 拆分路径和查询字符串
    if "?" in full_path:
        req.path, qs = full_path.split("?", 1)
        req.query = parse_qs(qs)        # ?a=1&b=2 → {"a": ["1"], "b": ["2"]}
    else:
        req.path = full_path

    req.path = unquote_plus(req.path)   # URL 解码：%20 → 空格

    # 后续行：请求头
    for line in lines[1:]:
        if ":" in line:
            key, value = line.split(":", 1)
            req.headers[key.strip().lower()] = value.strip()

    return req
```

注意头部 key 全部转小写存储（`key.strip().lower()`），这是 HTTP 规范中头部名称大小写不敏感的体现。

### 路由系统：路径参数编译为正则

路由的核心挑战是把 `/users/:id` 这样的模式匹配到 `/users/42` 这样的实际路径。

实现方式是把路径模式**编译成带命名捕获组的正则表达式**：

```python
class Router:
    def __init__(self):
        self._routes: list[tuple[str, re.Pattern, Handler]] = []

    def add(self, method: str, path: str, handler: Handler):
        pattern = self._compile(path)
        self._routes.append((method.upper(), pattern, handler))

    @staticmethod
    def _compile(path: str) -> re.Pattern:
        """/users/:id  →  ^/users/(?P<id>[^/]+)$"""
        regex = re.sub(r":(\w+)", r"(?P<\1>[^/]+)", path)
        return re.compile(f"^{regex}$")

    def match(self, method: str, path: str) -> tuple[Handler, dict[str, str]] | None:
        for route_method, pattern, handler in self._routes:
            if route_method != method.upper():
                continue
            m = pattern.fullmatch(path)
            if m:
                return handler, m.groupdict()  # {"id": "42"}
        return None
```

`(?P<id>[^/]+)` 是 Python 正则的命名捕获组语法：匹配一个或多个非 `/` 字符，捕获为名称 `id`。匹配成功后，`m.groupdict()` 直接返回 `{"id": "42"}`，赋值给 `req.params`。

编译时间（`_compile`）发生在路由注册时，请求处理时直接用编译好的 `re.Pattern` 做全字符串匹配（`fullmatch`），性能合理。

### 响应序列化

`Response` 对象转换为 HTTP 字节的过程很直白：

```python
def _format_response(self, resp: Response) -> bytes:
    status_text = STATUS_TEXT.get(resp.status, "Unknown")
    # 自动补充必要的头部
    resp.headers.setdefault("Content-Length", str(len(resp.body)))
    resp.headers.setdefault("Server", "mini-http")
    resp.headers.setdefault("Date", datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT"))
    resp.headers.setdefault("Connection", "close")

    lines = [f"HTTP/1.1 {resp.status} {status_text}"]
    for k, v in resp.headers.items():
        lines.append(f"{k}: {v}")
    header_block = "\r\n".join(lines) + "\r\n\r\n"
    return header_block.encode() + resp.body
```

`Content-Length` 是关键头部：客户端靠它知道 body 有多少字节，从而知道这次响应在哪里结束。mini-http 这里自动计算，业务代码不需要手动设置。

`Connection: close` 表示这次响应发完就关闭连接（没有 Keep-Alive），简化了实现。

### 线程模型

每个新连接在独立线程中处理：

```python
def run(self):
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)  # 端口复用，避免 TIME_WAIT
    srv.bind((self.host, self.port))
    srv.listen(128)  # 等待队列最大长度
    while True:
        conn, addr = srv.accept()
        t = threading.Thread(
            target=self._handle_connection,
            args=(conn, addr),
            daemon=True   # 主线程退出时自动杀掉所有子线程
        )
        t.start()
```

`SO_REUSEADDR` 是一个实用细节：没有它，服务器重启后可能遇到 `Address already in use` 错误，因为旧连接还处于 `TIME_WAIT` 状态。

### Response 便利构造器

```python
class Response:
    @classmethod
    def text(cls, body: str, status: int = 200) -> "Response":
        return cls(status, {"Content-Type": "text/plain; charset=utf-8"}, body.encode())

    @classmethod
    def json(cls, data, status: int = 200) -> "Response":
        payload = json.dumps(data, ensure_ascii=False).encode()
        return cls(status, {"Content-Type": "application/json"}, payload)

    @classmethod
    def html(cls, body: str, status: int = 200) -> "Response":
        return cls(status, {"Content-Type": "text/html; charset=utf-8"}, body.encode())
```

`ensure_ascii=False` 让 JSON 序列化保留中文等非 ASCII 字符，而不是转义成 `\uXXXX`。

---

## 如何运行

```bash
# 启动 demo 服务器
python demo.py
# 监听 http://localhost:8888

# 另一个终端测试
curl http://localhost:8888/                        # HTML 首页
curl http://localhost:8888/users/42               # 路径参数
curl http://localhost:8888/hello?name=World       # 查询字符串
curl -X POST http://localhost:8888/echo -d "hello from curl"  # POST + body

# 作为库使用
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

---

## 关键收获

**1. HTTP 是一个极其简单的协议（本质上）**

HTTP/1.1 的核心不过是：请求行 + 头部 + 空行 + body，响应格式相同。~190 行就能实现一个功能完整的服务器，说明协议本身并不复杂。复杂的是边界情况：分包、编码、Keep-Alive、TLS……

**2. 路由是正则的包装**

几乎所有 Web 框架的路由系统本质上都是：把 URL 模式编译成正则，收到请求时逐一匹配。Flask、Express、Rails 的路由内核都大同小异。理解了这一点，路由就不再神秘。

**3. TCP 是流，不是消息**

这是初学网络编程最容易踩的坑。`socket.recv(4096)` 返回的字节数不保证等于对方 `send()` 的字节数，数据可能分多次到达（分包），也可能多个请求粘在一起（粘包）。正确的做法是：依赖协议层的边界标志（HTTP 里是 `\r\n\r\n` + `Content-Length`）来确定一条消息的完整性。

**4. 线程 vs 异步 IO 的权衡**

mini-http 用一个连接一个线程的模型，实现简单但不适合高并发（线程有创建开销和内存占用）。真实的高性能服务器（nginx、Tornado、Go 的 net/http）用异步 IO 或协程池，同一个线程可以处理数千个并发连接。asyncio 版本（见 mini-redis 的设计）可以处理更高并发，但代码复杂度也更高。

**5. `Content-Length` 是协议的基石**

HTTP/1.1 在同一个 TCP 连接上可以发多个请求（Keep-Alive）。客户端靠 `Content-Length`（或 `Transfer-Encoding: chunked`）来知道每个响应在哪里结束，才能正确分割多个响应。mini-http 通过每次请求后关闭连接（`Connection: close`）回避了这个问题，但真实服务器必须正确处理它。

**6. 框架做的事情并不神秘**

实现这个服务器之后，Flask/FastAPI 的核心功能——路由注册（`@app.get`）、请求解析、响应构建——都可以在这 ~190 行里找到对应。框架的价值在于：处理所有边界情况、提供中间件系统、优化性能、提供生态。但核心概念是完全可以自己实现的。
