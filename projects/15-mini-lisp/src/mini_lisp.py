"""mini-lisp - tiny Lisp with reader, closures, and tail-call optimization."""

from __future__ import annotations

import math
import operator
from dataclasses import dataclass


def tokenize(source: str) -> list[str]:
    return source.replace("(", " ( ").replace(")", " ) ").replace("'", " ' ").split()


def atom(token: str):
    if token == "#t":
        return True
    if token == "#f":
        return False
    for cast in (int, float):
        try:
            return cast(token)
        except ValueError:
            pass
    return token


def read_from(tokens: list[str]):
    if not tokens:
        raise SyntaxError("unexpected EOF")
    token = tokens.pop(0)
    if token == "(":
        items = []
        while tokens and tokens[0] != ")":
            items.append(read_from(tokens))
        if not tokens:
            raise SyntaxError("missing )")
        tokens.pop(0)
        return items
    if token == ")":
        raise SyntaxError("unexpected )")
    if token == "'":
        return ["quote", read_from(tokens)]
    return atom(token)


def parse(source: str):
    expr = read_from(tokenize(source))
    return expr


class Env(dict):
    def __init__(self, bindings=(), values=(), outer: "Env | None" = None):
        super().__init__(zip(bindings, values))
        self.outer = outer

    def find(self, name: str) -> "Env":
        if name in self:
            return self
        if self.outer is None:
            raise NameError(name)
        return self.outer.find(name)


@dataclass
class Procedure:
    params: list[str]
    body: object
    env: Env


def prod(values: list[float]) -> float:
    result = 1
    for value in values:
        result *= value
    return result


def standard_env() -> Env:
    env = Env()
    env.update(
        {
            "+": lambda *xs: sum(xs),
            "-": lambda x, *xs: x - sum(xs) if xs else -x,
            "*": lambda *xs: prod(list(xs)),
            "/": lambda x, *xs: math.trunc(operator.truediv(x, prod(list(xs)))) if xs else 1 / x,
            ">": operator.gt,
            "<": operator.lt,
            ">=": operator.ge,
            "<=": operator.le,
            "=": operator.eq,
            "abs": abs,
            "car": lambda xs: xs[0],
            "cdr": lambda xs: xs[1:],
            "cons": lambda x, xs: [x] + xs,
            "list": lambda *xs: list(xs),
            "null?": lambda xs: xs == [],
            "not": lambda x: not x,
            "length": len,
            "print": lambda *xs: print(*xs),
        }
    )
    return env


GLOBAL_ENV = standard_env()


def evaluate(expr, env: Env | None = None):
    env = env or GLOBAL_ENV
    while True:
        if isinstance(expr, str):
            return env.find(expr)[expr]
        if not isinstance(expr, list):
            return expr
        if not expr:
            return []

        op = expr[0]
        if op == "quote":
            return expr[1]
        if op == "if":
            _, test, conseq, alt = expr
            expr = conseq if evaluate(test, env) else alt
            continue
        if op == "define":
            _, name, value = expr
            env[name] = evaluate(value, env)
            return env[name]
        if op == "lambda":
            _, params, body = expr
            return Procedure(params, body, env)
        if op == "begin":
            for form in expr[1:-1]:
                evaluate(form, env)
            expr = expr[-1]
            continue

        proc = evaluate(op, env)
        args = [evaluate(arg, env) for arg in expr[1:]]
        if isinstance(proc, Procedure):
            expr = proc.body
            env = Env(proc.params, args, proc.env)
            continue
        return proc(*args)


def run(source: str, env: Env | None = None):
    return evaluate(parse(source), env or Env(outer=GLOBAL_ENV))
