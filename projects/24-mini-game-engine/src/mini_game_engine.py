"""mini-game-engine — ECS, scene graph, input, fixed timestep, AABB collision."""

from __future__ import annotations
import time
from dataclasses import dataclass, field
from typing import Any, Callable

# ── Math ──────────────────────────────────────────────────────────────────────

@dataclass
class Vec2:
    x: float = 0.0
    y: float = 0.0
    def __add__(self, o: Vec2) -> Vec2: return Vec2(self.x + o.x, self.y + o.y)
    def __sub__(self, o: Vec2) -> Vec2: return Vec2(self.x - o.x, self.y - o.y)
    def __mul__(self, s: float) -> Vec2: return Vec2(self.x * s, self.y * s)
    def __repr__(self) -> str: return f"({self.x:.1f},{self.y:.1f})"

# ── ECS ───────────────────────────────────────────────────────────────────────

EntityId = int
_next_id: EntityId = 0

def new_entity() -> EntityId:
    global _next_id; _next_id += 1; return _next_id

class World:
    """Component tables keyed by type → O(1) add/get/remove per entity."""
    def __init__(self) -> None:
        self._tables: dict[type, dict[EntityId, Any]] = {}

    def spawn(self) -> EntityId:
        return new_entity()

    def destroy(self, eid: EntityId) -> None:
        for t in self._tables.values(): t.pop(eid, None)

    def add(self, eid: EntityId, component: Any) -> None:
        self._tables.setdefault(type(component), {})[eid] = component

    def get(self, eid: EntityId, t: type) -> Any | None:
        return self._tables.get(t, {}).get(eid)

    def query(self, *types: type) -> list[tuple]:
        if not types: return []
        first, *rest = types
        out = []
        for eid, c0 in list(self._tables.get(first, {}).items()):
            row = [self._tables.get(t, {}).get(eid) for t in rest]
            if all(c is not None for c in row):
                out.append(tuple([eid, c0] + row))
        return out

# ── Components ────────────────────────────────────────────────────────────────

@dataclass
class Transform:
    pos: Vec2 = field(default_factory=Vec2)

@dataclass
class Velocity:
    v: Vec2 = field(default_factory=Vec2)

@dataclass
class AABB:
    half: Vec2 = field(default_factory=lambda: Vec2(0.5, 0.5))
    def overlaps(self, ap: Vec2, b: AABB, bp: Vec2) -> bool:
        return abs(ap.x - bp.x) < self.half.x + b.half.x and \
               abs(ap.y - bp.y) < self.half.y + b.half.y

@dataclass
class Tag:
    name: str

@dataclass
class Script:
    update: Callable[[EntityId, "World", float], None]

@dataclass
class Parent:
    eid: EntityId

# ── Input ─────────────────────────────────────────────────────────────────────

class Input:
    def __init__(self) -> None:
        self._held: set[str] = set()
        self._pressed: set[str] = set()

    def press(self, key: str) -> None:
        if key not in self._held: self._pressed.add(key)
        self._held.add(key)

    def release(self, key: str) -> None:
        self._held.discard(key)

    def held(self, key: str) -> bool: return key in self._held
    def pressed(self, key: str) -> bool: return key in self._pressed
    def flush(self) -> None: self._pressed.clear()

# ── Scene graph ───────────────────────────────────────────────────────────────

class SceneGraph:
    def __init__(self) -> None:
        self._children: dict[EntityId, list[EntityId]] = {}

    def attach(self, parent: EntityId, child: EntityId) -> None:
        self._children.setdefault(parent, []).append(child)

    def world_pos(self, eid: EntityId, world: World) -> Vec2:
        tf = world.get(eid, Transform)
        pos = tf.pos if tf else Vec2()
        p = world.get(eid, Parent)
        return self.world_pos(p.eid, world) + pos if p else pos

# ── Engine ────────────────────────────────────────────────────────────────────

class Engine:
    FIXED_DT = 1.0 / 60.0

    def __init__(self) -> None:
        self.world = World()
        self.input = Input()
        self.scene = SceneGraph()
        self._systems: list[Callable] = []
        self._on_collision: list[Callable[[EntityId, EntityId], None]] = []
        self._acc = 0.0
        self._last = time.monotonic()
        self.running = False

    def add_system(self, fn: Callable) -> None:
        self._systems.append(fn)

    def on_collision(self, cb: Callable[[EntityId, EntityId], None]) -> None:
        self._on_collision.append(cb)

    def _integrate(self, dt: float) -> None:
        for eid, tf, vel in self.world.query(Transform, Velocity):
            tf.pos = tf.pos + vel.v * dt

    def _collide(self) -> None:
        pairs = self.world.query(Transform, AABB)
        for i in range(len(pairs)):
            ei, ti, bi = pairs[i]
            for j in range(i + 1, len(pairs)):
                ej, tj, bj = pairs[j]
                if bi.overlaps(ti.pos, bj, tj.pos):
                    for cb in self._on_collision: cb(ei, ej)

    def step(self) -> float:
        now = time.monotonic()
        dt = min(now - self._last, 0.25)
        self._last = now
        self._acc += dt
        while self._acc >= self.FIXED_DT:
            self._integrate(self.FIXED_DT)
            self._collide()
            self._acc -= self.FIXED_DT
        for s in self._systems: s(self.world, self.input, dt)
        for eid, script in self.world.query(Script): script.update(eid, self.world, dt)
        self.input.flush()
        return dt

    def run(self, max_steps: int = 0) -> None:
        self.running = True
        steps = 0
        while self.running:
            self.step()
            steps += 1
            if max_steps and steps >= max_steps: break
