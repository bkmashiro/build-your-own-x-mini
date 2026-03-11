#!/usr/bin/env python3
"""Demo server for mini-http."""

from mini_http import MiniHTTP, Response

app = MiniHTTP(port=8888)


@app.get("/")
def index(req):
    return Response.html("<h1>mini-http demo</h1><p>Try /hello, /users/42, or POST /echo</p>")


@app.get("/hello")
def hello(req):
    name = req.query.get("name", ["world"])[0]
    return Response.text(f"Hello, {name}!")


@app.get("/users/:id")
def get_user(req):
    return Response.json({"id": req.params["id"], "name": "Alice"})


@app.post("/echo")
def echo(req):
    return Response.json({"body": req.body.decode()})


if __name__ == "__main__":
    app.run()
