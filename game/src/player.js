// Solmar Heat — the player: Rio Calder, on foot and behind the wheel.
// On foot he walks with WASD; near a car, E steals it and he drives it with
// the same keys (W accelerate, S brake/reverse, A/D steer). E again gets out.

import { CONFIG } from './config.js';
import { makeCar, playerCar, spawnSparks } from './vehicles.js';
import { resolveBuildingCollision } from './city.js';

export function makePlayer(G) {
  return {
    name: 'Rio Calder',
    x: G.city.spots.start.x,
    y: G.city.spots.start.y,
    angle: -Math.PI / 2,
    health: CONFIG.PLAYER.health,
    money: 250,
    inCar: false,
    car: null,
    invuln: 0,
    walkBob: 0,
  };
}

export function updatePlayer(G, dt) {
  const p = G.player;
  const input = G.input;
  if (p.invuln > 0) p.invuln -= dt;

  if (p.inCar) updateDriving(G, dt);
  else updateOnFoot(G, dt);

  // Enter or exit a car. Only while actually playing: the city animates
  // behind the title screen, and a stray E there must not steal a car
  // before the game even starts.
  if (G.screen === 'play' && input.pressed('KeyE')) {
    if (p.inCar) exitCar(G);
    else tryEnterCar(G);
  }
}

function updateOnFoot(G, dt) {
  const p = G.player;
  const input = G.input;
  let mx = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);
  let my = (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0) - (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0);
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len;
    my /= len;
    p.x += mx * CONFIG.PLAYER.walkSpeed * dt;
    p.y += my * CONFIG.PLAYER.walkSpeed * dt;
    p.angle = Math.atan2(my, mx);
    p.walkBob += dt * 10;
  }
  // Stay out of buildings and the sea.
  const pos = { x: p.x, y: p.y };
  resolveBuildingCollision(G.city, pos, CONFIG.PLAYER.radius);
  p.x = pos.x;
  p.y = pos.y;
  p.x = Math.max(40, Math.min(CONFIG.WORLD_W - 40, p.x));
  p.y = Math.max(40, Math.min(CONFIG.SEA_Y - 24, p.y));
}

function updateDriving(G, dt) {
  const p = G.player;
  const car = p.car;
  const input = G.input;
  const cfg = CONFIG.CAR;
  const forward = input.down('KeyW') || input.down('ArrowUp');
  const back = input.down('KeyS') || input.down('ArrowDown');
  const steerLeft = input.down('KeyA') || input.down('ArrowLeft');
  const steerRight = input.down('KeyD') || input.down('ArrowRight');

  if (forward) car.speed += cfg.accel * dt;
  else if (back) {
    if (car.speed > 20) car.speed -= cfg.brake * dt;
    else car.speed -= cfg.reverseAccel * dt;
  } else {
    // Coast: gentle drag, plus stronger drag off-road.
    const drag = onRoad(G, car.x, car.y) ? 120 : 320;
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), drag * dt);
  }
  const top = car.model.topSpeed;
  car.speed = Math.max(-cfg.maxReverse, Math.min(top, car.speed));

  // Steering only bites while moving, and reverses when reversing.
  const steer = (steerRight ? 1 : 0) - (steerLeft ? 1 : 0);
  const grip = Math.min(1, Math.abs(car.speed) / 120);
  car.angle += steer * cfg.turnRate * grip * Math.sign(car.speed || 1) * dt;

  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  // Buildings stop the car hard; other cars bump it.
  const before = { x: car.x, y: car.y };
  const pos = { x: car.x, y: car.y };
  resolveBuildingCollision(G.city, pos, 20);
  car.x = pos.x;
  car.y = pos.y;
  if (car.x !== before.x || car.y !== before.y) {
    if (Math.abs(car.speed) > 120) {
      spawnSparks(G, car.x, car.y);
      G.audio.thud(0.4);
      car.health -= 2;
    }
    car.speed *= 0.4;
  }
  car.x = Math.max(40, Math.min(CONFIG.WORLD_W - 40, car.x));
  car.y = Math.max(40, Math.min(CONFIG.SEA_Y - 24, car.y));
  if (car.health <= 0 && car.smoke < 1) car.smoke = 1;

  // The player rides with the car.
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  G.audio.setEngine(Math.abs(car.speed) / top);
}

function onRoad(G, x, y) {
  const half = CONFIG.ROAD_W / 2;
  for (const a of G.city.avenues) if (Math.abs(x - a) < half) return true;
  for (const s of G.city.streets) if (Math.abs(y - s) < half) return true;
  return false;
}

// Nearest car the player could steal, within reach. A smoking wreck cannot
// be stolen: it is waiting for the tow truck, not a getaway car.
export function nearestCar(G, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars) {
    if (car.driver === 'police') continue;
    if (car.smoke > 0) continue;
    const d = Math.hypot(car.x - G.player.x, car.y - G.player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function tryEnterCar(G) {
  const p = G.player;
  const car = nearestCar(G, 64);
  if (!car) return;
  // Stealing a parked or traffic car is a crime: the law notices.
  car.driver = 'player';
  car.speed = 0;
  p.inCar = true;
  p.car = car;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  G.stats.carsStolen += 1;
  addWanted(G, 1, 'Grand theft auto');
  G.audio.blip(660);
  G.banner = { text: 'You took the ' + car.type + ' — nice wheels, Rio.', timer: 2.5 };
}

function exitCar(G) {
  const p = G.player;
  const car = p.car;
  car.driver = 'parked';
  car.speed = 0;
  p.inCar = false;
  p.car = null;
  // Step out to the side of the car.
  const side = { x: -Math.sin(car.angle), y: Math.cos(car.angle) };
  p.x = car.x + side.x * 34;
  p.y = car.y + side.y * 34;
  p.angle = car.angle;
  G.audio.setEngine(0);
}

export function addWanted(G, stars, reason) {
  const before = G.wanted;
  G.wanted = Math.min(CONFIG.WANTED.maxStars, G.wanted + stars);
  if (G.wanted > before) {
    G.wantedTimer = CONFIG.WANTED.decaySeconds;
    if (reason) G.banner = { text: reason + ' — wanted level ' + G.wanted + '!', timer: 2.5 };
    G.audio.sirenBurst();
  }
}

// Give the player a fresh car of the given type at a spot (used by shots).
// The car is placed in the right-hand lane for its heading, so it starts
// in traffic instead of on the centre line.
export function giveCar(G, type, x, y, angle) {
  const car = makeCar(type, x, y, angle);
  const rx = -Math.sin(angle);
  const ry = Math.cos(angle);
  car.x = x + rx * 20;
  car.y = y + ry * 20;
  car.driver = 'player';
  G.cars.push(car);
  G.player.inCar = true;
  G.player.car = car;
  G.player.x = car.x;
  G.player.y = car.y;
  G.player.angle = angle;
  return car;
}
