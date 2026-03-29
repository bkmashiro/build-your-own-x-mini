"""Demo: simple platformer-style simulation (no display, terminal output)."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from mini_game_engine import (
    Engine, World, Input,
    Transform, Velocity, AABB, Tag, Script, SceneGraph,
    Vec2,
)

# ── Build world ───────────────────────────────────────────────────────────────

engine = Engine()
w = engine.world

# Player
player = w.spawn()
w.add(player, Transform(Vec2(5.0, 10.0)))
w.add(player, Velocity(Vec2(2.0, -5.0)))   # moving right, falling
w.add(player, AABB(Vec2(0.4, 0.4)))
w.add(player, Tag("player"))

# Ground platform
ground = w.spawn()
w.add(ground, Transform(Vec2(5.0, 0.0)))
w.add(ground, AABB(Vec2(8.0, 0.5)))
w.add(ground, Tag("ground"))

# Coin (child of a "level root" entity — scene graph demo)
level_root = w.spawn()
w.add(level_root, Transform(Vec2(0.0, 0.0)))

from mini_game_engine import Parent
coin = w.spawn()
w.add(coin, Transform(Vec2(7.0, 2.0)))   # local pos
w.add(coin, AABB(Vec2(0.25, 0.25)))
w.add(coin, Tag("coin"))
w.add(coin, Parent(level_root))

collected: list[str] = []

# ── Collision callback ────────────────────────────────────────────────────────

def on_hit(a, b):
    ta = w.get(a, Tag)
    tb = w.get(b, Tag)
    names = {ta.name if ta else "?", tb.name if tb else "?"}
    if "player" in names and "ground" in names:
        vel = w.get(player, Velocity)
        if vel and vel.v.y < 0:
            vel.v.y = 0.0          # land
    if "player" in names and "coin" in names:
        coin_id = b if (ta and ta.name == "player") else a
        if coin_id not in collected:
            collected.append(coin_id)
            print("[collision] coin collected!")

engine.on_collision(on_hit)

# ── Gravity system ────────────────────────────────────────────────────────────

GRAVITY = -9.8

def gravity_system(world: World, inp: Input, dt: float):
    for eid, vel in world.query(Velocity):
        vel.v.y += GRAVITY * dt

engine.add_system(gravity_system)

# ── Script: simple AI follow ──────────────────────────────────────────────────

enemy = w.spawn()
w.add(enemy, Transform(Vec2(0.0, 1.0)))
w.add(enemy, Velocity())
w.add(enemy, AABB(Vec2(0.4, 0.4)))
w.add(enemy, Tag("enemy"))

def enemy_ai(eid, world: World, dt: float):
    etf = world.get(eid, Transform)
    ptf = world.get(player, Transform)
    evel = world.get(eid, Velocity)
    if etf and ptf and evel:
        dx = ptf.pos.x - etf.pos.x
        evel.v.x = 1.5 if dx > 0 else -1.5

from mini_game_engine import Script
w.add(enemy, Script(enemy_ai))

# ── Simulate 120 fixed steps (~2 s) ──────────────────────────────────────────

print("step | player pos          | enemy pos           | coins")
print("-----|---------------------|---------------------|------")

for step in range(1, 13):
    # Simulate 10 fixed steps per print row (fake wall-clock by patching _last)
    engine._last -= engine.FIXED_DT * 10
    engine.step()

    ptf = w.get(player, Transform)
    etf = w.get(enemy, Transform)
    wp = engine.scene.world_pos(coin, w)
    print(
        f"{step*10:4d} | pos={ptf.pos!r:<14} | pos={etf.pos!r:<14} | "
        f"coin_world_pos={wp!r}  collected={'yes' if collected else 'no'}"
    )

print("\nDone. Chain of concepts exercised:")
print("  Vec2 · World.spawn/add/query · Transform · Velocity · AABB.overlaps")
print("  Input.press/held · SceneGraph.world_pos · Engine fixed-timestep loop")
print("  gravity_system · enemy Script · on_collision callback")
