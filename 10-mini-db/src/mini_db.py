from __future__ import annotations

import bisect
import re


def tokenize(sql: str):
    return [t for t in re.findall(r"'[^']*'|[(),=*<>;]|[A-Za-z_][A-Za-z0-9_]*|\d+", sql) if t != ";"]


class MiniDB:
    def __init__(self):
        self.tables = {}

    def execute(self, sql: str):
        self.toks, self.i = tokenize(sql), 0
        cmd = self.take().upper()
        return getattr(self, f"parse_{cmd.lower()}")()

    def peek(self):
        return self.toks[self.i] if self.i < len(self.toks) else None

    def take(self, expect=None):
        tok = self.peek()
        if tok is None:
            raise SyntaxError("unexpected end")
        if expect and tok.upper() != expect:
            raise SyntaxError(f"expected {expect}, got {tok}")
        self.i += 1
        return tok

    def value(self, tok):
        return tok[1:-1] if tok.startswith("'") else int(tok) if tok.isdigit() else tok

    def parse_create(self):
        kind = self.take().upper()
        if kind == "TABLE":
            name = self.take()
            self.take("(")
            cols = []
            while self.peek() != ")":
                cols.append(self.take())
                if self.peek() == ",":
                    self.take(",")
            self.take(")")
            self.tables[name] = {"cols": cols, "rows": [], "indexes": {}}
            return f"created table {name}"
        if kind == "INDEX":
            idx = self.take()
            self.take("ON")
            table, col = self.take(), None
            self.take("(")
            col = self.take()
            self.take(")")
            rows = sorted((r[col], n) for n, r in enumerate(self.tables[table]["rows"]))
            self.tables[table]["indexes"][col] = {"name": idx, "keys": rows}
            return f"created index {idx}"
        raise SyntaxError(f"unsupported CREATE {kind}")

    def parse_insert(self):
        self.take("INTO")
        table = self.take()
        cols = self.tables[table]["cols"]
        if self.peek() == "(":
            self.take("(")
            cols = []
            while self.peek() != ")":
                cols.append(self.take())
                if self.peek() == ",":
                    self.take(",")
            self.take(")")
        self.take("VALUES")
        self.take("(")
        vals = []
        while self.peek() != ")":
            vals.append(self.value(self.take()))
            if self.peek() == ",":
                self.take(",")
        self.take(")")
        row = dict(zip(cols, vals))
        meta = self.tables[table]
        meta["rows"].append(row)
        for col, idx in meta["indexes"].items():
            bisect.insort(idx["keys"], (row[col], len(meta["rows"]) - 1))
        return row

    def parse_select(self):
        cols = [self.take()]
        while self.peek() == ",":
            self.take(",")
            cols.append(self.take())
        self.take("FROM")
        table = self.take()
        where = self.parse_where()
        rows = self.scan(table, where)
        if cols == ["*"]:
            return rows
        return [{c: row[c] for c in cols} for row in rows]

    def parse_delete(self):
        self.take("FROM")
        table = self.take()
        where = self.parse_where()
        meta = self.tables[table]
        keep, removed = [], 0
        for row in meta["rows"]:
            if self.eval(where, row):
                removed += 1
            else:
                keep.append(row)
        meta["rows"] = keep
        for col in list(meta["indexes"]):
            meta["indexes"][col]["keys"] = sorted((r[col], n) for n, r in enumerate(keep))
        return removed

    def parse_where(self):
        if self.peek() and self.peek().upper() == "WHERE":
            self.take("WHERE")
            return self.parse_or()
        return ("lit", True)

    def parse_or(self):
        node = self.parse_and()
        while self.peek() and self.peek().upper() == "OR":
            self.take("OR")
            node = ("or", node, self.parse_and())
        return node

    def parse_and(self):
        node = self.parse_cmp()
        while self.peek() and self.peek().upper() == "AND":
            self.take("AND")
            node = ("and", node, self.parse_cmp())
        return node

    def parse_cmp(self):
        if self.peek() == "(":
            self.take("(")
            node = self.parse_or()
            self.take(")")
            return node
        left, op, right = self.take(), self.take(), self.value(self.take())
        return ("cmp", left, op, right)

    def scan(self, table, where):
        meta = self.tables[table]
        if where[0] == "cmp" and where[2] == "=" and where[1] in meta["indexes"]:
            pairs = meta["indexes"][where[1]]["keys"]
            needle = (where[3], -1)
            lo = bisect.bisect_left(pairs, needle)
            hi = bisect.bisect_right(pairs, (where[3], 10**9))
            return [meta["rows"][n] for _, n in pairs[lo:hi] if self.eval(where, meta["rows"][n])]
        return [row for row in meta["rows"] if self.eval(where, row)]

    def eval(self, node, row):
        kind = node[0]
        if kind == "lit":
            return node[1]
        if kind == "cmp":
            a, op, b = row[node[1]], node[2], node[3]
            return a == b if op == "=" else a > b if op == ">" else a < b
        if kind == "and":
            return self.eval(node[1], row) and self.eval(node[2], row)
        return self.eval(node[1], row) or self.eval(node[2], row)


if __name__ == "__main__":
    db = MiniDB()
    print(db.execute("CREATE TABLE users (id, name, age)"))
    db.execute("INSERT INTO users VALUES (1, 'Ada', 36)")
    db.execute("INSERT INTO users VALUES (2, 'Linus', 28)")
    print(db.execute("SELECT name FROM users WHERE age > 30"))
