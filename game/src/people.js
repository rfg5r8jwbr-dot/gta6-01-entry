// Solmar Heat — people: pedestrians, on-foot police and armed thugs.
// Pedestrians stroll the pavements and flee from gunfire; police on foot chase
// the player and try to arrest him; thugs are the beachfront shootout crew.

import { CONFIG } from './config.js';
import { rngPick, rngRange } from './random.js';
import { resolveBuildingCollision } from './city.js';

const SHIRTS = [
  '#e86a5a',
  '#5a9bd4',
  '#f2c14e',
  '#7bc47f',
  '#b678d4',
  '#e8e8e8',
  '#ff9a3c',
  '#4ecdc4',
  '#ff5e8a',
  '#2ee6a8',
  '#ff7b2f',
  '#8aff4d',
];

export function makePed(G, x, y) {
  return {
    kind: 'ped',
    x,
    y,
    angle: rngRange(G.rng, 0, Math.PI * 2),
    speed: rngRange(G.rng, 32, 58),
    shirt: rngPick(G.rng, SHIRTS),
    state: 'walk',
    fleeTimer: 0,
    walkTimer: rngRange(G.rng, 2, 6),
    // waiting peds stand still: a fare passenger waiting for a pickup.
    waiting: false,
    dead: false,
    deadTimer: 0,
  };
}

// Place pedestrians on the pavements around a point (a plaza, the player's
// street, a beach): they make the city read as lived-in wherever the camera
// is looking. Used by the world populate step and by staged screenshots.
export function spawnPedCluster(G, cx, cy, count) {
  const placed = [];
  for (let i = 0; i < count; i++) {
    const road = nearestRoadSimple(G.city, cx + rngRange(G.rng, -260, 260), cy + rngRange(G.rng, -200, 200));
    let x;
    let y;
    if (road.kind === 'v') {
      x = road.coord + (G.rng() < 0.5 ? -52 : 52);
      y = cy + rngRange(G.rng, -240, 240);
    } else {
      x = cx + rngRange(G.rng, -320, 320);
      y = road.coord + (G.rng() < 0.5 ? -52 : 52);
    }
    x = Math.max(60, Math.min(CONFIG.WORLD_W - 60, x));
    y = Math.max(60, Math.min(CONFIG.SEA_Y - 30, y));
    const ped = spawnPed(G, x, y);
    G.people.push(ped);
    placed.push(ped);
  }
  return placed;
}

// Spawn a pedestrian on a pavement near the given point.
export function spawnPed(G, x, y) {
  const ped = makePed(G, x, y);
  // Face along the nearest road so peds walk the pavement, not through blocks.
  const road = nearestRoadSimple(G.city, x, y);
  if (road.kind === 'v') ped.angle = G.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
  else ped.angle = G.rng() < 0.5 ? 0 : Math.PI;
  return ped;
}

function nearestRoadSimple(city, x, y) {
  let bestV = city.avenues[0];
  let bestVd = Math.abs(x - bestV);
  for (const a of city.avenues) {
    const d = Math.abs(x - a);
    if (d < bestVd) {
      bestVd = d;
      bestV = a;
    }
  }
  let bestH = city.streets[0];
  let bestHd = Math.abs(y - bestH);
  for (const s of city.streets) {
    const d = Math.abs(y - s);
    if (d < bestHd) {
      bestHd = d;
      bestH = s;
    }
  }
  return bestVd < bestHd ? { kind: 'v', coord: bestV } : { kind: 'h', coord: bestH };
}

export function updatePed(G, ped, dt) {
  if (ped.dead) {
    ped.deadTimer += dt;
    return;
  }
  // A waiting ped (fare passenger) stands put until picked up.
  if (ped.waiting) return;
  // Flee from the player when he is shooting or the wanted level is high.
  const dx = ped.x - G.player.x;
  const dy = ped.y - G.player.y;
  const dist = Math.hypot(dx, dy);
  const scared = G.combatNoise > 0.3 && dist < 420;
  if (scared && ped.state !== 'flee') {
    ped.state = 'flee';
    ped.fleeTimer = 2.5;
    ped.angle = Math.atan2(dy, dx);
  }
  if (ped.state === 'flee') {
    ped.fleeTimer -= dt;
    ped.speed = 150;
    if (ped.fleeTimer <= 0) {
      ped.state = 'walk';
      ped.speed = rngRange(G.rng, 32, 58);
    }
  } else {
    ped.walkTimer -= dt;
    if (ped.walkTimer <= 0) {
      ped.walkTimer = rngRange(G.rng, 2, 7);
      // Turn at random: keep walking, turn left, or turn right.
      const roll = G.rng();
      if (roll < 0.3) ped.angle += Math.PI / 2;
      else if (roll < 0.6) ped.angle -= Math.PI / 2;
      else if (roll < 0.7) ped.angle += Math.PI;
    }
  }
  ped.x += Math.cos(ped.angle) * ped.speed * dt;
  ped.y += Math.sin(ped.angle) * ped.speed * dt;
  // Stay inside the city and out of buildings and the sea.
  ped.x = Math.max(50, Math.min(CONFIG.WORLD_W - 50, ped.x));
  ped.y = Math.max(50, Math.min(CONFIG.SEA_Y - 30, ped.y));
  const pos = { x: ped.x, y: ped.y };
  resolveBuildingCollision(G.city, pos, 12);
  ped.x = pos.x;
  ped.y = pos.y;
}

// On-foot police: run at the player and hold him to arrest him.
export function makeFootCop(G, x, y) {
  return {
    kind: 'cop',
    x,
    y,
    angle: 0,
    speed: 175,
    shirt: '#20242c',
    state: 'chase',
    grabTimer: 0,
    shootTimer: 0,
    health: 100,
    dead: false,
    deadTimer: 0,
  };
}

export function updateFootCop(G, cop, dt) {
  if (cop.dead) {
    cop.deadTimer += dt;
    return;
  }
  const dx = G.player.x - cop.x;
  const dy = G.player.y - cop.y;
  const dist = Math.hypot(dx, dy) || 1;
  cop.angle = Math.atan2(dy, dx);
  if (G.player.inCar) {
    // Cops cannot catch a car: jog after it, then give up and stand.
    if (dist < 500) {
      cop.x += (dx / dist) * cop.speed * 0.6 * dt;
      cop.y += (dy / dist) * cop.speed * 0.6 * dt;
    }
    cop.grabTimer = 0;
    return;
  }
  if (dist < 26) {
    cop.grabTimer += dt;
    if (cop.grabTimer > CONFIG.POLICE.arrestTime) {
      G.screen = 'busted';
      G.audio.jingle('busted');
      G.stats.busted += 1;
    }
  } else {
    cop.grabTimer = 0;
    cop.x += (dx / dist) * cop.speed * dt;
    cop.y += (dy / dist) * cop.speed * dt;
  }
  const pos = { x: cop.x, y: cop.y };
  resolveBuildingCollision(G.city, pos, 12);
  cop.x = pos.x;
  cop.y = pos.y;
}

// Armed thug for the beachfront mission: holds ground and shoots.
export function makeThug(G, x, y) {
  return {
    kind: 'thug',
    x,
    y,
    angle: 0,
    speed: 60,
    shirt: '#7a2e2e',
    state: 'guard',
    shootTimer: rngRange(G.rng, 0.4, 1.2),
    // Sidestep direction when dodging a car, picked once per approach.
    dodge: 0,
    health: 100,
    dead: false,
    deadTimer: 0,
  };
}

export function updateThug(G, thug, dt) {
  if (thug.dead) {
    thug.deadTimer += dt;
    return;
  }
  const dx = G.player.x - thug.x;
  const dy = G.player.y - thug.y;
  const dist = Math.hypot(dx, dy) || 1;
  thug.angle = Math.atan2(dy, dx);
  // A fast car bearing down is not a gunfight: sidestep out of its path so
  // the crew cannot be run over on the open beach (they take no run-over
  // damage either — see world.js).
  const pc = G.player.inCar ? G.player.car : null;
  if (pc && Math.abs(pc.speed) > 60 && dist < 150) {
    if (thug.dodge === 0) thug.dodge = G.rng() < 0.5 ? 1 : -1;
    thug.x += -Math.sin(thug.angle) * thug.dodge * 130 * dt;
    thug.y += Math.cos(thug.angle) * thug.dodge * 130 * dt;
  } else if (!pc || Math.abs(pc.speed) <= 60) {
    thug.dodge = 0;
  }
  // Keep a little distance, strafe slowly, and shoot when in range.
  if (dist > 320) {
    thug.x += (dx / dist) * thug.speed * dt;
    thug.y += (dy / dist) * thug.speed * dt;
  }
  thug.shootTimer -= dt;
  if (thug.shootTimer <= 0 && dist < 480 && !G.player.inCar) {
    thug.shootTimer = rngRange(G.rng, 0.9, 1.6);
    G.bullets.push({
      x: thug.x + Math.cos(thug.angle) * 16,
      y: thug.y + Math.sin(thug.angle) * 16,
      vx: Math.cos(thug.angle) * CONFIG.COMBAT.bulletSpeed * 0.85,
      vy: Math.sin(thug.angle) * CONFIG.COMBAT.bulletSpeed * 0.85,
      life: CONFIG.COMBAT.bulletLife,
      from: 'thug',
      damage: CONFIG.COMBAT.thugDamage,
    });
    G.audio.gunshot(0.35);
  }
  const pos = { x: thug.x, y: thug.y };
  resolveBuildingCollision(G.city, pos, 12);
  thug.x = pos.x;
  thug.y = pos.y;
}

// Draw one person top-down: shadow, body, head, and a badge for police.
export function drawPerson(ctx, p, time) {
  if (p.dead && p.deadTimer > 4) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 11, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  if (p.dead) {
    // Fallen: lying flat.
    ctx.rotate(p.angle + Math.PI / 2);
    ctx.fillStyle = p.shirt;
    ctx.fillRect(-12, -5, 24, 10);
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(15, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(p.angle);
  // Legs swing while walking.
  const swing = Math.sin(time * 9 + p.x) * 3;
  ctx.fillStyle = '#2c3242';
  ctx.fillRect(-4, -8 + swing * 0.4, 8, 4);
  ctx.fillRect(-4, 4 - swing * 0.4, 8, 4);
  // Body — v2 made people a touch bigger so they read at screenshot scale.
  ctx.fillStyle = p.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
  ctx.fill();
  // Head.
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(4, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  if (p.kind === 'cop') {
    ctx.fillStyle = '#20242c';
    ctx.fillRect(-2, -6, 8, 12);
    ctx.fillStyle = '#ffd23e';
    ctx.fillRect(2, -2, 2, 4);
  }
  if (p.kind === 'thug') {
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(16, 0);
    ctx.stroke();
  }
  ctx.restore();
}
