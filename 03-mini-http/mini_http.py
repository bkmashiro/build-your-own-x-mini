#!/usr/bin/env python3
"""
mini-http: A minimal HTTP/1.1 server in pure Python.

Uses only socket, threading, os — no http.server, no frameworks.

Implements:
  - HTTP/1.1 request parsing (method, path, headers, body)
  - Response formatting (status line, headers, body)
  - Path parameters (/users/:id → req.params["id"])
  - Convenience builders: Response.text(), .json(), .html()
  - Threaded connection handling

Usage:
  app = MiniHTTP(port=8080)

  @app.get("/")
  def index(req):
      return Response.text("hello")

  app.run()
"""

import json
import os
import re
import socket
import threading
from datetime import datetime, timezone
from typing import Callable
from urllib.parse import unquote_plus, parse_qs


# ─────────────────────────────────────────────────────────────
# HTTP Status Codes
# ─────────────────────────────────────────────────────────────

STATUS_TEXT = {
    200: "OK", 201: "Created", 204: "No Content",
    301: "Moved Permanently", 302: "Found", 304: "Not Modified",
    400: "Bad Request", 403: "Forbidden", 404: "Not Found",
    405: "Method Not Allowed", 500: "Internal Server Error",
}


# ─────────────────────────────────────────────────────────────
# Request / Response
# ─────────────────────────────────────────────────────────────
# HTTP/1.1 message format:
#   Request:  METHOD /path HTTP/1.1\r\nHeader: val\r\n\r\nbody
#   Response: HTTP/1.1 200 OK\r\nHeader: val\r\n\r\nbody

class Request:
    """Parsed HTTP request."""

    def __init__(self):
        self.method: str = ""
        self.path: str = ""
        self.query: dict[str, list[str]] = {}
        self.headers: dict[str, str] = {}
        self.body: bytes = b""
        self.params: dict[str, str] = {}  # path parameters from :name patterns


class Response:
    """HTTP response with convenience constructors."""

    def __init__(self, status: int = 200, headers: dict[str, str] | None = None, body: bytes = b""):
        self.status = status
        self.headers = headers or {}
        self.body = body

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

    @classmethod
    def not_found(cls) -> "Response":
        return cls.text("404 Not Found", 404)


# Type alias for route handlers
Handler = Callable[[Request], Response]


# ─────────────────────────────────────────────────────────────
# Router
# ─────────────────────────────────────────────────────────────
# Routes are stored as (method, regex_pattern, param_names, handler).
# Path parameters like /users/:id compile to /users/(?P<id>[^/]+).

class Router:
    """Method + path → handler, with path parameter support."""

    def __init__(self):
        self._routes: list[tuple[str, re.Pattern, Handler]] = []

    def add(self, method: str, path: str, handler: Handler):
        pattern = self._compile(path)
        self._routes.append((method.upper(), pattern, handler))

    def get(self, path: str):
        """Decorator: register a GET handler."""
        def decorator(fn: Handler) -> Handler:
            self.add("GET", path, fn)
            return fn
        return decorator

    def post(self, path: str):
        """Decorator: register a POST handler."""
        def decorator(fn: Handler) -> Handler:
            self.add("POST", path, fn)
            return fn
        return decorator

    def match(self, method: str, path: str) -> tuple[Handler, dict[str, str]] | None:
        """Find a matching route. Returns (handler, params) or None."""
        for route_method, pattern, handler in self._routes:
            if route_method != method.upper():
                continue
            m = pattern.fullmatch(path)
            if m:
                return handler, m.groupdict()
        return None

    @staticmethod
    def _compile(path: str) -> re.Pattern:
        """Convert /users/:id to regex /users/(?P<id>[^/]+)."""
        # Replace :param_name with named capture group
        regex = re.sub(r":(\w+)", r"(?P<\1>[^/]+)", path)
        return re.compile(f"^{regex}$")


# ─────────────────────────────────────────────────────────────
# Server
# ─────────────────────────────────────────────────────────────
# TCP socket → read raw bytes → parse HTTP → route → format response → send.
# Each connection handled in a separate thread.

class MiniHTTP:
    """Minimal HTTP/1.1 server."""

    def __init__(self, host: str = "0.0.0.0", port: int = 8080):
        self.host = host
        self.port = port
        self.router = Router()

    # ── Decorator shortcuts ──

    def get(self, path: str):
        return self.router.get(path)

    def post(self, path: str):
        return self.router.post(path)

    def route(self, path: str, methods: list[str] | None = None):
        """Register a handler for multiple methods."""
        methods = methods or ["GET"]
        def decorator(fn: Handler) -> Handler:
            for m in methods:
                self.router.add(m, path, fn)
            return fn
        return decorator

    # ── Server lifecycle ──

    def run(self):
        """Start the server (blocks forever)."""
        srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        srv.bind((self.host, self.port))
        srv.listen(128)
        print(f"mini-http listening on http://{self.host}:{self.port}")
        try:
            while True:
                conn, addr = srv.accept()
                t = threading.Thread(target=self._handle_connection, args=(conn, addr), daemon=True)
                t.start()
        except KeyboardInterrupt:
            print("\nShutting down.")
        finally:
            srv.close()

    # ── Connection handling ──

    def _handle_connection(self, conn: socket.socket, addr):
        """Read one request, dispatch, send response, close."""
        try:
            raw = self._recv_request(conn)
            if not raw:
                return
            req = self._parse_request(raw)
            # Route lookup
            result = self.router.match(req.method, req.path)
            if result is None:
                resp = Response.not_found()
            else:
                handler, params = result
                req.params = params
                try:
                    resp = handler(req)
                except Exception as e:
                    resp = Response.text(f"500 Internal Server Error\n{e}", 500)
            conn.sendall(self._format_response(resp))
        except Exception:
            pass  # malformed request — drop silently
        finally:
            conn.close()

    def _recv_request(self, conn: socket.socket) -> bytes:
        """Read a full HTTP request from the socket."""
        conn.settimeout(5.0)
        buf = b""
        # Read until we have the full headers (terminated by \r\n\r\n)
        while b"\r\n\r\n" not in buf:
            chunk = conn.recv(4096)
            if not chunk:
                return b""
            buf += chunk
        # Check Content-Length for body
        header_end = buf.index(b"\r\n\r\n") + 4
        headers_raw = buf[:header_end].decode(errors="replace").lower()
        content_length = 0
        for line in headers_raw.split("\r\n"):
            if line.startswith("content-length:"):
                content_length = int(line.split(":", 1)[1].strip())
                break
        # Read remaining body bytes if needed
        body_so_far = len(buf) - header_end
        while body_so_far < content_length:
            chunk = conn.recv(4096)
            if not chunk:
                break
            buf += chunk
            body_so_far += len(chunk)
        return buf

    # ── Parsing / Formatting ──

    def _parse_request(self, raw: bytes) -> Request:
        """Parse raw HTTP bytes into a Request object.

        HTTP/1.1 request format:
            GET /path?key=val HTTP/1.1\r\n
            Host: localhost\r\n
            Content-Length: 5\r\n
            \r\n
            body_
        """
        req = Request()
        header_end = raw.index(b"\r\n\r\n")
        header_section = raw[:header_end].decode(errors="replace")
        req.body = raw[header_end + 4:]

        lines = header_section.split("\r\n")
        # Request line: METHOD /path HTTP/1.1
        request_line = lines[0]
        parts = request_line.split(" ", 2)
        req.method = parts[0].upper()
        full_path = parts[1] if len(parts) > 1 else "/"

        # Split path and query string
        if "?" in full_path:
            req.path, qs = full_path.split("?", 1)
            req.query = parse_qs(qs)
        else:
            req.path = full_path

        # URL-decode the path
        req.path = unquote_plus(req.path)

        # Headers: key: value
        for line in lines[1:]:
            if ":" in line:
                key, value = line.split(":", 1)
                req.headers[key.strip().lower()] = value.strip()

        return req

    def _format_response(self, resp: Response) -> bytes:
        """Serialize a Response into HTTP/1.1 wire format.

        HTTP/1.1 response format:
            HTTP/1.1 200 OK\r\n
            Content-Length: 5\r\n
            \r\n
            hello
        """
        status_text = STATUS_TEXT.get(resp.status, "Unknown")
        # Build headers — always include Content-Length, Date, Server
        resp.headers.setdefault("Content-Length", str(len(resp.body)))
        resp.headers.setdefault("Server", "mini-http")
        resp.headers.setdefault("Date", datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT"))
        resp.headers.setdefault("Connection", "close")

        lines = [f"HTTP/1.1 {resp.status} {status_text}"]
        for k, v in resp.headers.items():
            lines.append(f"{k}: {v}")
        header_block = "\r\n".join(lines) + "\r\n\r\n"
        return header_block.encode() + resp.body
