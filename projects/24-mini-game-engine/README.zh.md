# mini-game-engine

约 170 行 Python 实现的极简游戏引擎。
从零构建 ECS（实体组件系统）、场景图、输入管理、固定时间步长循环和 AABB 碰撞检测。

## 核心概念

| 概念 | 说明 |
|------|------|
| **ECS** | 实体为纯整数 ID；组件为数据结构，按类型存储在哈希表中；系统通过 `world.query(...)` 迭代 |
| **World** | 组件中央存储 — `spawn`、`add`、`get`、`query`、`destroy` |
| **固定时间步长** | 物理累加器确保以 60 Hz 运行确定性模拟，与帧率无关 |
| **AABB 碰撞** | 轴对齐包围盒重叠测试；每对重叠实体触发回调 |
| **场景图** | `SceneGraph.world_pos` 沿 `Parent` 链递归计算全局位置 |
| **输入** | 按键按下/持续/释放状态，每帧刷新 |
| **Script 组件** | 每个实体的 `update(eid, world, dt)` 回调，用于 AI 与游戏逻辑 |

## 架构

```
Engine.step()
  ├── 累积帧时间 → 固定步长物理循环
  │     ├── _integrate(dt)   — 速度 → 位置
  │     └── _collide()       — AABB 碰撞对 → on_collision 回调
  ├── 执行用户系统(world, input, dt)
  └── 执行每个实体的 Script 组件
```

## 使用示例

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
engine.on_collision(lambda a, b: print(f"碰撞: {a} <-> {b}"))
engine.run(max_steps=120)
```

## 运行演示

```bash
python demo.py
```

演示模拟一个平台跳跃场景：玩家在重力下下落，落到平台上，收集金币，同时敌人 AI 脚本追踪玩家。
