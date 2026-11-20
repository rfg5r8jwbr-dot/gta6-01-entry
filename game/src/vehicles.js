// Solmar Heat — vehicles: car models, traffic AI, police cruisers.
// Traffic cars drive the road grid on the right-hand lane and turn at
// junctions; police cruisers chase the player freely and ram. Every car is
// drawn top-down as a distinct shape with its own colours.

import { CONFIG } from './config.js';
import { rngPick, rngRange } from './random.js';
import { resolveBuildingCollision } from './city.js';

// Car models: length, width, top speed, acceleration, body colour choices.
export const CAR_MODELS = {
  sedan: { len: 46, wid: 22, topSpeed: 380, accel: 300, colors: ['#c94f43', '#4a7fb5', '#d8cdb4', '#5e6b7a', '#7a4a8a'] },
  taxi: { len: 46, wid: 22, topSpeed: 360, accel: 300, colors: ['#f2b705'] },
  truck: { len: 62, wid: 26, topSpeed: 280, accel: 200, colors: ['#8a8f98', '#b5763a', '#5d7a52'] },
  sports: { len: 48, wid: 22, topSpeed: 540, accel: 460, colors: ['#e33e2b', '#ffd23e', '#19b8a6', '#f27d16'] },
  police: { len: 48, wid: 23, topSpeed: 500, accel: 430, colors: ['#20242c'] },
};

let nextCarId = 1;

export function makeCar(type, x, y, angle) {
  const model = CAR_MODELS[type];
  return {
    id: nextCarId++,
    type,
    model,
    color: rngPick(Math.random, model.colors),
    x,
    y,
    angle,
    speed: 0,
    health: 100,
    driver: 'traffic',
    // Traffic state: which road the car is on, how far along it, lane offset.
    roadKind: 'v',
    roadCoord: x,
    along: y,
    perp: 20,
    targetSpeed: rngRange(Math.random, 120, 200),
    turnCooldown: 0,
    smoke: 0,
  };
}

// Spawn a traffic car on a road near the given point.
export function spawnTrafficCar(G, x, y) {
  const types = ['sedan', 'sedan', 'sedan', 'taxi', 'truck', 'sports'];
  const type = rngPick(G.rng, types);
  const car = makeCar(type, x, y, 0);
  car.driver = 'traffic';
  // Snap onto the nearest road, heading along it.
  const road = nearestRoadFor(G, x, y);
  car.roadKind = road.kind;
  car.roadCoord = road.coord;
  const dir = G.rng() < 0.5 ? 1 : -1;
  if (road.kind === 'v') {
    car.along = y;
    car.y = y;
    car.x = road.coord + (dir > 0 ? -20 : 20);
    car.angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    car.along = x;
    car.x = x;
    car.y = road.coord + (dir > 0 ? 20 : -20);
    car.angle = dir > 0 ? 0 : Math.PI;
  }
  car.perp = 20;
  car.targetSpeed = rngRange(G.rng, 110, 210);
  return car;
}

function nearestRoadFor(G, x, y) {
  let bestV = G.city.avenues[0];
  let bestVd = Math.abs(x - bestV);
  for (const a of G.city.avenues) {
    const d = Math.abs(x - a);
    if (d < bestVd) {
      bestVd = d;
      bestV = a;
    }
  }
  let bestH = G.city.streets[0];
  let bestHd = Math.abs(y - bestH);
  for (const s of G.city.streets) {
    const d = Math.abs(y - s);
    if (d < bestHd) {
      bestHd = d;
      bestH = s;
    }
  }
  return bestVd < bestHd ? { kind: 'v', coord: bestV } : { kind: 'h', coord: bestH };
}

// Is there a road crossing at this along-position on this road?
function crossingAt(G, kind, along) {
  const lines = kind === 'v' ? G.city.streets : G.city.avenues;
  for (const c of lines) {
    if (Math.abs(along - c) < 26) return c;
  }
  return null;
}

// Drive one traffic car along the grid. Turns at junctions, slows for the
// car ahead, and eases back into its lane after a turn.
export function updateTrafficCar(G, car, dt) {
  car.turnCooldown -= dt;
  const forward = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
  const right = { x: -Math.sin(car.angle), y: Math.cos(car.angle) };

  // Slow down for a car ahead on the same road.
  let desired = car.targetSpeed;
  for (const other of G.cars) {
    if (other === car || other.driver === 'police') continue;
    if (other.roadKind !== car.roadKind || other.roadCoord !== car.roadCoord) continue;
    const gap = (other.along - car.along) * (car.roadKind === 'v' ? Math.sign(forward.y) : Math.sign(forward.x));
    if (gap > 0 && gap < 78) desired = Math.min(desired, 40);
    if (gap > 0 && gap < 46) desired = 0;
  }
  // Slow for the player car ahead too.
  const pc = playerCar(G);
  if (pc && pc !== car) {
    const dx = pc.x - car.x;
    const dy = pc.y - car.y;
    const ahead = dx * forward.x + dy * forward.y;
    const side = Math.abs(dx * right.x + dy * right.y);
    if (ahead > 0 && ahead < 70 && side < 30) desired = 0;
  }

  car.speed += Math.max(-500 * dt, Math.min(260 * dt, desired - car.speed));
  if (car.speed < 0) car.speed = 0;
  car.along += (car.roadKind === 'v' ? Math.sign(forward.y) : Math.sign(forward.x)) * car.speed * dt;

  // Turn at a junction, sometimes.
  const cross = crossingAt(G, car.roadKind, car.along);
  if (cross !== null && car.turnCooldown <= 0) {
    const roll = G.rng();
    car.turnCooldown = 1.2;
    if (roll < 0.3) {
      // Turn left or right onto the crossing road.
      const turnLeft = G.rng() < 0.5;
      const newHeading = turnHeading(car.angle, turnLeft);
      const oldAlong = car.along;
      car.roadKind = car.roadKind === 'v' ? 'h' : 'v';
      car.roadCoord = cross;
      car.along = car.roadKind === 'v' ? car.y : car.x;
      car.angle = newHeading;
      // Keep the along coordinate consistent with the new road.
      if (car.roadKind === 'h') car.along = car.x;
      else car.along = car.y;
      void oldAlong;
    }
  }

  // Ease the lane offset back to +20 (right-hand lane).
  car.perp += (20 - car.perp) * Math.min(1, 4 * dt);

  // Recompute the world position from road state.
  const f = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
  const r = { x: -Math.sin(car.angle), y: Math.cos(car.angle) };
  if (car.roadKind === 'v') {
    car.x = car.roadCoord + r.x * car.perp;
    car.y = car.along;
  } else {
    car.x = car.along;
    car.y = car.roadCoord + r.y * car.perp;
  }
  void f;
  // Keep inside the city.
  car.x = Math.max(60, Math.min(CONFIG.WORLD_W - 60, car.x));
  car.y = Math.max(60, Math.min(CONFIG.WORLD_H - 60, car.y));
}

function turnHeading(angle, left) {
  const quarter = Math.PI / 2;
  const step = left ? -quarter : quarter;
  let next = angle + step;
  while (next > Math.PI) next -= 2 * Math.PI;
  while (next <= -Math.PI) next += 2 * Math.PI;
  return next;
}

export function playerCar(G) {
  return G.player.inCar ? G.player.car : null;
}

// Police cruiser pursuit: steer toward the player, accelerate, ram on contact.
export function updatePoliceCar(G, car, dt) {
  const target = G.player.inCar ? G.player.car : G.player;
  const tx = target.x;
  const ty = target.y;
  const dx = tx - car.x;
  const dy = ty - car.y;
  const dist = Math.hypot(dx, dy) || 1;
  const wantAngle = Math.atan2(dy, dx);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  const turn = Math.max(-CONFIG.POLICE.cruiserTurn * dt, Math.min(CONFIG.POLICE.cruiserTurn * dt, diff));
  car.angle += turn;
  const wantSpeed = dist > 120 ? CONFIG.POLICE.cruiserSpeed : CONFIG.POLICE.cruiserSpeed * 0.75;
  car.speed += Math.max(-700 * dt, Math.min(430 * dt, wantSpeed - car.speed));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const pos = { x: car.x, y: car.y };
  resolveBuildingCollision(G.city, pos, 22);
  car.x = pos.x;
  car.y = pos.y;

  // Ram the player.
  if (dist < 46) {
    if (G.player.inCar) {
      const pc = G.player.car;
      pc.health -= CONFIG.POLICE.ramDamage * dt * 3;
      pc.speed *= 0.985;
      car.speed *= 0.9;
      spawnSparks(G, car.x, car.y);
      if (pc.health <= 0) {
        pc.health = 0;
        pc.smoke = 1;
      }
    } else {
      hurtPlayer(G, CONFIG.POLICE.ramDamage * dt * 3);
      G.player.x += (dx / dist) * 30 * dt;
      G.player.y += (dy / dist) * 30 * dt;
    }
  }
}

export function hurtPlayer(G, amount) {
  if (G.player.invuln > 0) return;
  G.player.health -= amount;
  G.player.invuln = 0.25;
  if (G.player.health <= 0) {
    G.player.health = 0;
    G.screen = 'wasted';
    G.audio.jingle('wasted');
  }
}

export function spawnSparks(G, x, y) {
  for (let i = 0; i < 6; i++) {
    G.particles.push({
      kind: 'spark',
      x,
      y,
      vx: (G.rng() - 0.5) * 260,
      vy: (G.rng() - 0.5) * 260,
      life: 0.35,
      maxLife: 0.35,
    });
  }
}

export function spawnSmoke(G, x, y) {
  G.particles.push({
    kind: 'smoke',
    x,
    y,
    vx: (G.rng() - 0.5) * 30,
    vy: -30 - G.rng() * 30,
    life: 1.1,
    maxLife: 1.1,
  });
}

// Draw one car top-down: body, cabin, windshield, wheels, headlights, and a
// flashing light bar on police cruisers.
export function drawCar(ctx, car, time) {
  const { len, wid } = car.model;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  roundRect(ctx, -len / 2 + 3, -wid / 2 + 4, len, wid, 8);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#14161a';
  const wy = wid / 2 - 2;
  ctx.fillRect(-len / 2 + 6, -wy - 3, 12, 5);
  ctx.fillRect(-len / 2 + 6, wy - 2, 12, 5);
  ctx.fillRect(len / 2 - 18, -wy - 3, 12, 5);
  ctx.fillRect(len / 2 - 18, wy - 2, 12, 5);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 8);
  ctx.fill();
  if (car.type === 'police') {
    ctx.fillStyle = '#e8e8e8';
    roundRect(ctx, -len / 2 + 8, -wid / 2, len - 26, wid, 8);
    ctx.fill();
    ctx.fillStyle = '#20242c';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
  }
  if (car.type === 'taxi') {
    ctx.fillStyle = '#20242c';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  if (car.type === 'truck') {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(-len / 2 + 4, -wid / 2 + 4, len * 0.45, wid - 8);
  }
  // Cabin and windshield.
  ctx.fillStyle = car.type === 'truck' ? '#20242c' : '#20242c';
  const cabinX = car.type === 'truck' ? len / 2 - 16 : -2;
  const cabinW = car.type === 'truck' ? 12 : len * 0.34;
  roundRect(ctx, cabinX - cabinW / 2, -wid / 2 + 4, cabinW, wid - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(150, 210, 235, 0.85)';
  ctx.fillRect(cabinX - cabinW / 2 + 2, -wid / 2 + 6, cabinW - 4, 3);
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(len / 2 - 2, -wid / 2 + 3, 3, 4);
  ctx.fillRect(len / 2 - 2, wid / 2 - 7, 3, 4);
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(-len / 2, -wid / 2 + 3, 3, 4);
  ctx.fillRect(-len / 2, wid / 2 - 7, 3, 4);
  // Police light bar, flashing red and blue.
  if (car.type === 'police') {
    const phase = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = phase ? '#ff2d2d' : '#2d7bff';
    ctx.fillRect(-8, -wid / 2 + 2, 7, 5);
    ctx.fillStyle = phase ? '#2d7bff' : '#ff2d2d';
    ctx.fillRect(1, -wid / 2 + 2, 7, 5);
  }
  // Damage smoke.
  if (car.smoke > 0) {
    ctx.fillStyle = 'rgba(60,60,60,0.5)';
    ctx.beginPath();
    ctx.arc(-len / 4, 0, 8 + Math.sin(time * 9) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
