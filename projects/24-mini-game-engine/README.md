# mini-game-engine

A minimal game engine in ~170 lines of Python.
Implements an ECS (Entity Component System), scene graph, input manager, fixed-timestep loop, and AABB collision detection from scratch.

## Concepts

| Concept | Description |
|---------|-------------|
| **ECS** | Entities are plain IDs; components are data structs stored in per-type tables; systems iterate `world.query(...)` |
| **World** | Central component store — `spawn`, `add`, `get`, `query`, `destroy` |
| **Fixed timestep** | Physics accumulator ensures deterministic simulation at 60 Hz regardless of frame rate |
| **AABB collision** | Axis-aligned bounding box overlap test; callbacks fired on each overlapping pair |
| **Scene graph** | `SceneGraph.world_pos` resolves a chain of `Parent` components to compute global position |
| **Input** | Key press/held/release state, flushed each frame |
| **Script component** | Per-entity `update(eid, world, dt)` callback for AI / game logic |

## Architecture

```
Engine.step()
  ├── accumulate frame time → fixed-dt physics ticks
  │     ├── _integrate(dt)   — apply Velocity → Transform
  │     └── _collide()       — AABB pairs → on_collision callbacks
  ├── run user systems(world, input, dt)
  └── run Script components per entity
```

## Usage

```python
from src.mini_game_engine import Engine, World, Transform, Velocity, AABB, Tag, Vec2

engine = Engine()
w = engine.world

player = w.spawn()
w.add(player, Transform(Vec2(0, 5)))
w.add(player, Velocity(Vec2(1, -2)))
w.add(player, AABB(Vec2(0.4, 0.4)))
w.add(player, Tag("player"))

def gravity(world, inp, dt):
    for eid, vel in world.query(Velocity):
        vel.v.y -= 9.8 * dt

engine.add_system(gravity)
engine.on_collision(lambda a, b: print(f"hit: {a} <-> {b}"))
engine.run(max_steps=120)
```

## Run demo

```bash
python demo.py
```

The demo simulates a platformer scene: player falls under gravity, lands on a platform, collects a coin, while an enemy AI script chases the player.
