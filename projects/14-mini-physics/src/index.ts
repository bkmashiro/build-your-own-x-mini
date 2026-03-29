export interface Vec2 {
  x: number;
  y: number;
}

export interface BodyOptions {
  position: Vec2;
  size: Vec2;
  velocity?: Vec2;
  mass?: number;
  restitution?: number;
  static?: boolean;
}

export interface Body {
  position: Vec2;
  velocity: Vec2;
  size: Vec2;
  mass: number;
  invMass: number;
  restitution: number;
  static: boolean;
}

export interface Collision {
  a: Body;
  b: Body;
  normal: Vec2;
  penetration: number;
}

export interface World {
  gravity: Vec2;
  bodies: Body[];
}

export function createBody(options: BodyOptions): Body {
  const isStatic = options.static ?? false;
  const mass = isStatic ? Infinity : Math.max(options.mass ?? 1, 1e-6);
  return {
    position: { ...options.position },
    velocity: { x: 0, y: 0, ...options.velocity },
    size: { ...options.size },
    mass,
    invMass: isStatic ? 0 : 1 / mass,
    restitution: options.restitution ?? 0.2,
    static: isStatic,
  };
}

export function createWorld(gravity: Vec2 = { x: 0, y: -9.8 }): World {
  return { gravity: { ...gravity }, bodies: [] };
}

export function addBody(world: World, body: Body): Body {
  world.bodies.push(body);
  return body;
}

export function step(world: World, dt: number, iterations = 1): Collision[] {
  for (const body of world.bodies) {
    if (body.invMass === 0) {
      continue;
    }
    body.velocity.x += world.gravity.x * dt;
    body.velocity.y += world.gravity.y * dt;
    body.position.x += body.velocity.x * dt;
    body.position.y += body.velocity.y * dt;
  }

  const collisions = detectCollisions(world.bodies);
  for (let i = 0; i < iterations; i += 1) {
    for (const collision of collisions) {
      resolveCollision(collision);
    }
  }
  return collisions;
}

function detectCollisions(bodies: Body[]): Collision[] {
  const collisions: Collision[] = [];
  for (let i = 0; i < bodies.length; i += 1) {
    for (let j = i + 1; j < bodies.length; j += 1) {
      const collision = collide(bodies[i], bodies[j]);
      if (collision) {
        collisions.push(collision);
      }
    }
  }
  return collisions;
}

function collide(a: Body, b: Body): Collision | null {
  const dx = b.position.x - a.position.x;
  const px = a.size.x / 2 + b.size.x / 2 - Math.abs(dx);
  if (px <= 0) {
    return null;
  }

  const dy = b.position.y - a.position.y;
  const py = a.size.y / 2 + b.size.y / 2 - Math.abs(dy);
  if (py <= 0) {
    return null;
  }

  if (px < py) {
    return {
      a,
      b,
      normal: { x: dx < 0 ? -1 : 1, y: 0 },
      penetration: px,
    };
  }

  return {
    a,
    b,
    normal: { x: 0, y: dy < 0 ? -1 : 1 },
    penetration: py,
  };
}

function resolveCollision({ a, b, normal, penetration }: Collision): void {
  const invMassSum = a.invMass + b.invMass;
  if (invMassSum === 0) {
    return;
  }

  const relativeVelocity = {
    x: b.velocity.x - a.velocity.x,
    y: b.velocity.y - a.velocity.y,
  };
  const velocityAlongNormal =
    relativeVelocity.x * normal.x + relativeVelocity.y * normal.y;

  if (velocityAlongNormal < 0) {
    const restitution = Math.min(a.restitution, b.restitution);
    const impulseMagnitude = (-(1 + restitution) * velocityAlongNormal) / invMassSum;
    const impulse = {
      x: normal.x * impulseMagnitude,
      y: normal.y * impulseMagnitude,
    };

    a.velocity.x -= impulse.x * a.invMass;
    a.velocity.y -= impulse.y * a.invMass;
    b.velocity.x += impulse.x * b.invMass;
    b.velocity.y += impulse.y * b.invMass;
  }

  const correction = Math.max(penetration - 0.01, 0) * 0.8 / invMassSum;
  a.position.x -= normal.x * correction * a.invMass;
  a.position.y -= normal.y * correction * a.invMass;
  b.position.x += normal.x * correction * b.invMass;
  b.position.y += normal.y * correction * b.invMass;
}
