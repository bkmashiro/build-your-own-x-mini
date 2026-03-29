# mini-physics

> A tiny 2D rigid-body playground with AABB collisions, impulse resolution, and a fixed-step world update.

[中文](README.zh.md)

---

## Background

Most game physics engines look intimidating because they bundle broad phase, contact manifolds, sleeping, friction, joints, and many shape types. The core loop is much smaller:

- integrate velocity into position
- detect overlaps
- compute a collision normal and penetration depth
- push bodies apart and apply an impulse along the contact normal

This project keeps only that minimal loop and uses axis-aligned boxes so the collision math stays readable.

---

## Architecture

```text
step(world, dt)
  -> integrate gravity + velocity
  -> detect overlapping AABB pairs
  -> resolve each collision
       - relative velocity along normal
       - restitution impulse
       - positional correction
```

`Body` stores `position`, `velocity`, `size`, and inverse mass. Static bodies simply use `invMass = 0`, so the same solver works for dynamic-vs-static and dynamic-vs-dynamic pairs.

The collision test computes overlap on both axes:

- if either overlap is non-positive, the boxes do not intersect
- otherwise the smaller overlap axis becomes the contact normal
- impulse is applied only when bodies are moving into each other

That gives a compact but faithful version of how many real-time engines resolve box contacts.

---

## How to Run

```bash
npm test
npm run demo
```

The package uses Node's built-in test runner with `--experimental-strip-types`, so there is no TypeScript build step.

---

## What This Omits

- rotation and angular velocity
- friction and resting contact stabilization
- swept collision / continuous collision detection
- broad-phase acceleration structures

Those features matter for a production engine, but they are not required to understand rigid-body stepping and impulse-based contact resolution.
