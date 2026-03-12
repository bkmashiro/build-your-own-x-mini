from __future__ import annotations

import ast


BINOPS = {ast.Add: "ADD", ast.Sub: "SUB", ast.Mult: "MUL", ast.FloorDiv: "DIV", ast.Div: "DIV", ast.Mod: "MOD"}


class Compiler:
    def __init__(self):
        self.code, self.funcs = [], {}

    def emit(self, op, *args):
        self.code.append((op, *args))
        return len(self.code) - 1

    def patch(self, at, value):
        self.code[at] = (self.code[at][0], value)

    def compile(self, src: str):
        tree = ast.parse(src)
        funcs = [n for n in tree.body if isinstance(n, ast.FunctionDef)]
        self.block([n for n in tree.body if not isinstance(n, ast.FunctionDef)])
        self.emit("HALT")
        for fn in funcs:
            self.funcs[fn.name] = {"addr": len(self.code), "args": [a.arg for a in fn.args.args]}
            self.block(fn.body)
            self.emit("PUSH", 0)
            self.emit("RET")
        return {"code": self.code, "funcs": self.funcs}

    def block(self, body):
        for node in body:
            self.stmt(node)

    def stmt(self, node):
        if isinstance(node, ast.Assign):
            self.expr(node.value)
            self.emit("STORE", node.targets[0].id)
        elif isinstance(node, ast.Return):
            self.expr(node.value or ast.Constant(0))
            self.emit("RET")
        elif isinstance(node, ast.If):
            self.expr(node.test)
            skip = self.emit("JUMP_IF", None)
            self.block(node.body)
            if node.orelse:
                done = self.emit("JUMP", None)
                self.patch(skip, len(self.code))
                self.block(node.orelse)
                self.patch(done, len(self.code))
            else:
                self.patch(skip, len(self.code))
        elif isinstance(node, ast.While):
            start = len(self.code)
            self.expr(node.test)
            done = self.emit("JUMP_IF", None)
            self.block(node.body)
            self.emit("JUMP", start)
            self.patch(done, len(self.code))
        elif isinstance(node, ast.Expr):
            self.expr(node.value)
            self.emit("POP")
        else:
            raise SyntaxError(ast.dump(node))

    def expr(self, node):
        if isinstance(node, ast.Constant):
            self.emit("PUSH", node.value)
        elif isinstance(node, ast.Name):
            self.emit("LOAD", node.id)
        elif isinstance(node, ast.BinOp) and type(node.op) in BINOPS:
            self.expr(node.left)
            self.expr(node.right)
            self.emit(BINOPS[type(node.op)])
        elif isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
            self.emit("PUSH", 0)
            self.expr(node.operand)
            self.emit("SUB")
        elif isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name) and node.func.id == "print":
                self.expr(node.args[0])
                self.emit("PRINT")
                self.emit("PUSH", 0)
            else:
                for arg in node.args:
                    self.expr(arg)
                self.emit("CALL", node.func.id, len(node.args))
        else:
            raise SyntaxError(ast.dump(node))


class VM:
    def __init__(self, program):
        self.code, self.funcs = program["code"], program["funcs"]
        self.stack, self.frames = [], [{"locals": {}, "ret": None, "name": "<main>"}]

    def pop2(self):
        b = self.stack.pop()
        a = self.stack.pop()
        return a, b

    def run(self):
        ip = 0
        while True:
            op, *args = self.code[ip]
            ip += 1
            if op == "PUSH":
                self.stack.append(args[0])
            elif op == "POP":
                if self.stack:
                    self.stack.pop()
            elif op == "LOAD":
                self.stack.append(self.frames[-1]["locals"].get(args[0], 0))
            elif op == "STORE":
                self.frames[-1]["locals"][args[0]] = self.stack.pop()
            elif op in {"ADD", "SUB", "MUL", "DIV", "MOD"}:
                a, b = self.pop2()
                self.stack.append(a + b if op == "ADD" else a - b if op == "SUB" else a * b if op == "MUL" else a // b if op == "DIV" else a % b)
            elif op == "JUMP":
                ip = args[0]
            elif op == "JUMP_IF":
                if not self.stack.pop():
                    ip = args[0]
            elif op == "CALL":
                name, argc = args
                fn = self.funcs[name]
                vals = self.stack[-argc:]
                del self.stack[-argc:]
                self.frames.append({"locals": dict(zip(fn["args"], vals)), "ret": ip, "name": name})
                ip = fn["addr"]
            elif op == "RET":
                val = self.stack.pop() if self.stack else 0
                frame = self.frames.pop()
                if frame["ret"] is None:
                    return val
                ip = frame["ret"]
                self.stack.append(val)
            elif op == "PRINT":
                print(self.stack.pop())
            elif op == "HALT":
                return self.stack[-1] if self.stack else None


def disassemble(program):
    out = []
    labels = {meta["addr"]: f"{name}:" for name, meta in program["funcs"].items()}
    for i, ins in enumerate(program["code"]):
        if i in labels:
            out.append(labels[i])
        op = ins[0]
        arg = " ".join(map(str, ins[1:]))
        out.append(f"{i:02d}  {op}{(' ' + arg) if arg else ''}")
    return "\n".join(out)


def compile_source(src: str):
    return Compiler().compile(src)


def run_source(src: str, show=True):
    program = compile_source(src)
    if show:
        print(disassemble(program))
        print("\noutput:")
    return VM(program).run()


if __name__ == "__main__":
    SAMPLE = """
def fact(n):
    acc = 1
    while n:
        acc = acc * n
        n = n - 1
    return acc

print(fact(5))
"""
    run_source(SAMPLE)
