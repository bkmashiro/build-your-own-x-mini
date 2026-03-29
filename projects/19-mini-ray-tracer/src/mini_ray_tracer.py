"""mini-ray-tracer - tiny ray tracer with BVH, shadows, and reflections."""

from __future__ import annotations

from math import sqrt


def add(a, b): return (a[0] + b[0], a[1] + b[1], a[2] + b[2])
def sub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
def mul(a, k): return (a[0] * k, a[1] * k, a[2] * k)
def dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def unit(v): return mul(v, 1 / max(sqrt(dot(v, v)), 1e-9))
def mix(a, b, t): return add(mul(a, 1 - t), mul(b, t))
def clamp(c): return tuple(max(0, min(255, int(v * 255 + 0.5))) for v in c)


class Sphere:
    def __init__(self, c, r, color, reflect=0.0):
        self.c, self.r, self.color, self.reflect = c, r, color, reflect
        self.box = (sub(c, (r, r, r)), add(c, (r, r, r)))

    def hit(self, ro, rd, tmin=1e-4, tmax=1e9):
        oc = sub(ro, self.c)
        b, c = dot(oc, rd), dot(oc, oc) - self.r * self.r
        h = b * b - c
        if h < 0:
            return None
        h = sqrt(h)
        for t in (-b - h, -b + h):
            if tmin < t < tmax:
                p = add(ro, mul(rd, t))
                return t, p, unit(sub(p, self.c)), self


def box_join(items):
    lo = [1e9] * 3
    hi = [-1e9] * 3
    for mn, mx in items:
        for i in range(3):
            lo[i], hi[i] = min(lo[i], mn[i]), max(hi[i], mx[i])
    return tuple(lo), tuple(hi)


def build_bvh(items):
    if len(items) <= 2:
        return {"box": box_join([o.box for o in items]), "items": items}
    box = box_join([o.box for o in items])
    axis = max(range(3), key=lambda i: box[1][i] - box[0][i])
    items = sorted(items, key=lambda o: o.c[axis])
    mid = len(items) // 2
    left, right = build_bvh(items[:mid]), build_bvh(items[mid:])
    return {"box": box, "left": left, "right": right}


def hit_box(box, ro, rd, tmin=1e-4, tmax=1e9):
    for i in range(3):
        inv = 1 / (rd[i] or 1e-9)
        t0 = (box[0][i] - ro[i]) * inv
        t1 = (box[1][i] - ro[i]) * inv
        if inv < 0:
            t0, t1 = t1, t0
        tmin, tmax = max(tmin, t0), min(tmax, t1)
        if tmax <= tmin:
            return False
    return True


def traverse(node, ro, rd, tmin=1e-4, tmax=1e9):
    if not hit_box(node["box"], ro, rd, tmin, tmax):
        return None
    if "items" in node:
        best = None
        for obj in node["items"]:
            h = obj.hit(ro, rd, tmin, tmax)
            if h and h[0] < tmax:
                best, tmax = h, h[0]
        return best
    a = traverse(node["left"], ro, rd, tmin, tmax)
    if a:
        tmax = a[0]
    b = traverse(node["right"], ro, rd, tmin, tmax)
    return b or a


class Scene:
    def __init__(self, objects, light=(5, 5, -4), sky=((0.7, 0.85, 1.0), (0.1, 0.15, 0.3))):
        self.objects, self.light, self.sky = objects, light, sky
        self.bvh = build_bvh(objects)

    def shade(self, ro, rd, depth=3):
        hit = traverse(self.bvh, ro, rd)
        if not hit:
            t = 0.5 * (rd[1] + 1)
            return mix(self.sky[1], self.sky[0], t)
        dist, p, n, obj = hit
        to_light = unit(sub(self.light, p))
        shadow = traverse(self.bvh, add(p, mul(n, 1e-3)), to_light, 1e-4, sqrt(dot(sub(self.light, p), sub(self.light, p))))
        diff = max(0.1, dot(n, to_light)) * (0.25 if shadow else 1.0)
        color = mul(obj.color, diff)
        if depth and obj.reflect:
            refl = sub(rd, mul(n, 2 * dot(rd, n)))
            bounce = self.shade(add(p, mul(n, 1e-3)), unit(refl), depth - 1)
            color = mix(color, bounce, obj.reflect)
        return color

    def render(self, w, h, samples=1):
        cam = (0, 0.25, -3.5)
        rows = []
        for y in range(h):
            row = []
            for x in range(w):
                color = (0.0, 0.0, 0.0)
                for sy in range(samples):
                    for sx in range(samples):
                        u = ((x + (sx + 0.5) / samples) / w) * 2 - 1
                        v = 1 - ((y + (sy + 0.5) / samples) / h) * 2
                        rd = unit((u * w / h, v, 1.6))
                        color = add(color, self.shade(cam, rd))
                row.append(clamp(mul(color, 1 / (samples * samples))))
            rows.append(row)
        return rows


def write_ppm(path, pixels):
    h, w = len(pixels), len(pixels[0])
    with open(path, "w", encoding="ascii") as f:
        f.write(f"P3\n{w} {h}\n255\n")
        for row in pixels:
            f.write(" ".join(f"{r} {g} {b}" for r, g, b in row) + "\n")
