import { addBody, createBody, createWorld, step } from "./src/index.ts";

const world = createWorld({ x: 0, y: -9.8 });
const floor = addBody(
  world,
  createBody({ position: { x: 0, y: -3 }, size: { x: 20, y: 2 }, static: true }),
);
void floor;

const box = addBody(
  world,
  createBody({
    position: { x: -4, y: 4 },
    size: { x: 1, y: 1 },
    velocity: { x: 4, y: 0 },
    restitution: 0.4,
  }),
);

for (let frame = 0; frame < 12; frame += 1) {
  step(world, 0.2, 4);
  console.log(
    `frame=${frame} pos=(${box.position.x.toFixed(2)}, ${box.position.y.toFixed(2)}) vel=(${box.velocity.x.toFixed(2)}, ${box.velocity.y.toFixed(2)})`,
  );
}
