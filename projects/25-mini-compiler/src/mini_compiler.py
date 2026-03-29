"""mini-compiler - lexer, parser, AST, and stack-code generator."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Token:
    kind: str
    value: str


@dataclass
class Number:
    value: int | float


@dataclass
class Name:
    value: str


@dataclass
class UnaryOp:
    op: str
    operand: object


@dataclass
class BinaryOp:
    op: str
    left: object
    right: object


@dataclass
class Assign:
    name: str
    value: object


@dataclass
class Program:
    statements: list[object]


def tokenize(source: str) -> list[Token]:
    tokens, i = [], 0
    while i < len(source):
        ch = source[i]
        if ch in " \t\r":
            i += 1
        elif ch == "\n":
            tokens.append(Token("SEMI", ";"))
            i += 1
        elif ch in "+-*/=();":
            tokens.append(Token("SEMI" if ch == ";" else ch, ch))
            i += 1
        elif ch.isdigit():
            j = i
            while i < len(source) and (source[i].isdigit() or source[i] == "."):
                i += 1
            tokens.append(Token("NUMBER", source[j:i]))
        elif ch.isalpha() or ch == "_":
            j = i
            while i < len(source) and (source[i].isalnum() or source[i] == "_"):
                i += 1
            tokens.append(Token("IDENT", source[j:i]))
        else:
            raise SyntaxError(f"unexpected character: {ch}")
    return tokens + [Token("EOF", "")]


class Parser:
    def __init__(self, tokens: list[Token]):
        self.tokens = tokens
        self.pos = 0

    def peek(self, offset: int = 0) -> Token:
        return self.tokens[self.pos + offset]

    def match(self, *kinds: str) -> bool:
        if self.peek().kind in kinds:
            self.pos += 1
            return True
        return False

    def expect(self, kind: str) -> Token:
        token = self.peek()
        if token.kind != kind:
            raise SyntaxError(f"expected {kind}, got {token.kind}")
        self.pos += 1
        return token

    def parse(self) -> Program:
        statements = []
        while self.peek().kind != "EOF":
            if self.match("SEMI"):
                continue
            statements.append(self.statement())
            self.match("SEMI")
        return Program(statements)

    def statement(self):
        if self.peek().kind == "IDENT" and self.peek(1).kind == "=":
            name = self.expect("IDENT").value
            self.expect("=")
            return Assign(name, self.expression())
        return self.expression()

    def expression(self):
        node = self.term()
        while self.peek().kind in {"+", "-"}:
            op = self.expect(self.peek().kind).value
            node = BinaryOp(op, node, self.term())
        return node

    def term(self):
        node = self.factor()
        while self.peek().kind in {"*", "/"}:
            op = self.expect(self.peek().kind).value
            node = BinaryOp(op, node, self.factor())
        return node

    def factor(self):
        token = self.peek()
        if self.match("+", "-"):
            return UnaryOp(token.value, self.factor())
        if self.match("NUMBER"):
            value = float(token.value) if "." in token.value else int(token.value)
            return Number(value)
        if self.match("IDENT"):
            return Name(token.value)
        if self.match("("):
            node = self.expression()
            self.expect(")")
            return node
        raise SyntaxError(f"unexpected token: {token.kind}")


def parse(source: str) -> Program:
    return Parser(tokenize(source)).parse()


OPS = {"+": "ADD", "-": "SUB", "*": "MUL", "/": "DIV"}


def generate(node) -> list[str]:
    if isinstance(node, Program):
        code = []
        for stmt in node.statements:
            code.extend(generate(stmt))
        return code
    if isinstance(node, Assign):
        return generate(node.value) + [f"STORE {node.name}"]
    if isinstance(node, Number):
        return [f"PUSH {node.value}"]
    if isinstance(node, Name):
        return [f"LOAD {node.value}"]
    if isinstance(node, UnaryOp):
        code = generate(node.operand)
        return code if node.op == "+" else code + ["NEG"]
    if isinstance(node, BinaryOp):
        return generate(node.left) + generate(node.right) + [OPS[node.op]]
    raise TypeError(f"unsupported node: {type(node).__name__}")


def compile_source(source: str) -> tuple[list[Token], Program, list[str]]:
    tokens = tokenize(source)
    ast = Parser(tokens).parse()
    return tokens[:-1], ast, generate(ast)


def run(code: list[str], env: dict[str, float] | None = None) -> tuple[dict[str, float], float | None]:
    stack, env = [], env or {}
    for inst in code:
        op, *arg = inst.split()
        if op == "PUSH":
            value = float(arg[0]) if "." in arg[0] else int(arg[0])
            stack.append(value)
        elif op == "LOAD":
            stack.append(env[arg[0]])
        elif op == "STORE":
            env[arg[0]] = stack[-1]
        elif op == "NEG":
            stack.append(-stack.pop())
        else:
            b, a = stack.pop(), stack.pop()
            stack.append({ "ADD": a + b, "SUB": a - b, "MUL": a * b, "DIV": a / b }[op])
    return env, stack[-1] if stack else None
