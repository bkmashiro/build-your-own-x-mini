from __future__ import annotations


class MiniMalloc:
    H, END = 12, 0xFFFFFFFF

    def __init__(self, size=128):
        self.heap, self.head = bytearray(size), 0
        self.set(0, size - self.H, 1, self.END)

    def rd(self, off, i):
        j = off + i * 4
        return int.from_bytes(self.heap[j:j + 4], "little")

    def wr(self, off, i, v):
        j = off + i * 4
        self.heap[j:j + 4] = int(v).to_bytes(4, "little")

    def block(self, off):
        return self.rd(off, 0), self.rd(off, 1), self.rd(off, 2)

    def set(self, off, size, free, nxt):
        self.wr(off, 0, size)
        self.wr(off, 1, free)
        self.wr(off, 2, nxt if nxt != -1 else self.END)

    def malloc(self, need):
        off = self.head
        while off != self.END:
            size, free, nxt = self.block(off)
            if free and size >= need:
                if size >= need + self.H + 1:
                    new = off + self.H + need
                    self.set(new, size - need - self.H, 1, nxt)
                    self.set(off, need, 0, new)
                else:
                    self.set(off, size, 0, nxt)
                return off + self.H
            off = nxt
        return None

    def free(self, ptr):
        if ptr is None:
            return
        off = ptr - self.H
        size, _, nxt = self.block(off)
        self.set(off, size, 1, nxt)
        self.coalesce()

    def coalesce(self):
        off = self.head
        while off != self.END:
            size, free, nxt = self.block(off)
            if nxt != self.END and off + self.H + size == nxt:
                nsize, nfree, nnxt = self.block(nxt)
                if free and nfree:
                    self.set(off, size + self.H + nsize, 1, nnxt)
                    continue
            off = nxt

    def realloc(self, ptr, need):
        if ptr is None:
            return self.malloc(need)
        if need == 0:
            self.free(ptr)
            return None
        off = ptr - self.H
        size, free, nxt = self.block(off)
        if free:
            return None
        if size >= need:
            self.resize(off, need)
            return ptr
        if nxt != self.END and off + self.H + size == nxt:
            nsize, nfree, nnxt = self.block(nxt)
            if nfree and size + self.H + nsize >= need:
                self.set(off, size + self.H + nsize, 0, nnxt)
                self.resize(off, need)
                return ptr
        new = self.malloc(need)
        if new is None:
            return None
        self.heap[new:new + size] = self.heap[ptr:ptr + size]
        self.free(ptr)
        return new

    def resize(self, off, need):
        size, free, nxt = self.block(off)
        if size >= need + self.H + 1:
            new = off + self.H + need
            self.set(new, size - need - self.H, 1, nxt)
            self.set(off, need, free, new)
            self.coalesce()

    def write(self, ptr, data: bytes):
        size, _, _ = self.block(ptr - self.H)
        self.heap[ptr:ptr + min(size, len(data))] = data[:size]

    def read(self, ptr, n=None):
        size, _, _ = self.block(ptr - self.H)
        n = size if n is None else min(size, n)
        return bytes(self.heap[ptr:ptr + n])

    def layout(self):
        out, off = [], self.head
        while off != self.END:
            size, free, nxt = self.block(off)
            out.append(f"[{off:03d}:{'free' if free else 'used'}:{size}]")
            off = nxt
        return " ".join(out)

    def dump(self):
        print(self.layout())


if __name__ == "__main__":
    heap = MiniMalloc(96)
    a = heap.malloc(16)
    b = heap.malloc(8)
    heap.dump()
    heap.free(a)
    heap.free(b)
    heap.dump()
