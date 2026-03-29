import test from "node:test";
import assert from "node:assert/strict";

import { addBody, createBody, createWorld, step } from "../src/index.ts";

test("integrates velocity and gravity for dynamic bodies", () => {
  const world = createWorld({ x: 0, y: -10 });
  const body = addBody(
    world,
    createBody({
      position: { x: 0, y: 10 },
      size: { x: 1, y: 1 },
      velocity: { x: 2, y: 0 },
    }),
  );

  step(world, 0.5);

  assert.equal(body.position.x, 1);
  assert.equal(body.velocity.y, -5);
  assert.equal(body.position.y, 7.5);
});

test("resolves dynamic body against a static floor", () => {
  const world = createWorld({ x: 0, y: 0 });
  const floor = addBody(
    world,
    createBody({
      position: { x: 0, y: 0 },
      size: { x: 10, y: 2 },
      static: true,
    }),
  );
  const box = addBody(
    world,
    createBody({
      position: { x: 0, y: 0.8 },
      size: { x: 2, y: 2 },
      velocity: { x: 0, y: -5 },
      restitution: 0,
    }),
  );

  const collisions = step(world, 0, 4);

  assert.equal(collisions.length, 1);
  assert.equal(collisions[0].a, floor);
  assert.equal(collisions[0].b, box);
  assert.deepEqual(collisions[0].normal, { x: 0, y: 1 });
  assert.equal(box.velocity.y, 0);
  assert.ok(box.position.y > 1.55);
});

test("applies 1D impulse exchange for equal-mass boxes", () => {
  const world = createWorld({ x: 0, y: 0 });
  const left = addBody(
    world,
    createBody({
      position: { x: -0.9, y: 0 },
      size: { x: 2, y: 2 },
      velocity: { x: 3, y: 0 },
      restitution: 1,
    }),
  );
  const right = addBody(
    world,
    createBody({
      position: { x: 0.9, y: 0 },
      size: { x: 2, y: 2 },
      velocity: { x: -1, y: 0 },
      restitution: 1,
    }),
  );

  step(world, 0, 4);

  assert.equal(left.velocity.x, -1);
  assert.equal(right.velocity.x, 3);
});

test("skips impulse when bodies are already separating", () => {
  const world = createWorld({ x: 0, y: 0 });
  const left = addBody(
    world,
    createBody({
      position: { x: -0.8, y: 0 },
      size: { x: 2, y: 2 },
      velocity: { x: -2, y: 0 },
      restitution: 1,
    }),
  );
  const right = addBody(
    world,
    createBody({
      position: { x: 0.8, y: 0 },
      size: { x: 2, y: 2 },
      velocity: { x: 2, y: 0 },
      restitution: 1,
    }),
  );

  step(world, 0, 4);

  assert.equal(left.velocity.x, -2);
  assert.equal(right.velocity.x, 2);
  assert.ok(left.position.x < -0.8);
  assert.ok(right.position.x > 0.8);
});
