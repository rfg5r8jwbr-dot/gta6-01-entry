// Solmar Heat — the world simulation: one fixed 1/60s step.
// Wires the player, traffic, police, pedestrians, combat, wanted level,
// pickups and missions together, and moves the camera.

import { CONFIG } from './config.js';
import { updatePlayer, addWanted } from './player.js';
import { updateTrafficCar, updatePoliceCar, playerCar, spawnSmoke, spawnTrafficCar } from './vehicles.js';
import { updatePed, updateFootCop, updateThug, spawnPed, spawnPedCluster } from './people.js';
import { updateBullets, updateParticles, tryShoot } from './combat.js';
import { updateMission, startMission, spawnPoliceCar, spawnFootCop, startFare, updateFare } from './missions.js';
import { rngRange } from './random.js';

export const STEP = 1 / 60;

export function createWorld(seed) {
  return {
    seed,
    time: 0,
    clockMinutes: 17 * 60 + 24,
    wanted: 0,
    wantedTimer: 0,
    combatNoise: 0,
    fireCooldown: 0,
    screen: 'title',
    mission: null,
    missionsDone: [],
    missionComplete: null,
    nextMissionAt: 0,
    nextMissionIndex: 0,
    storyComplete: false,
    // Repeatable taxi fares in free roam (see missions.js).
    fare: null,
    nextFareAt: 0,
    faresDone: 0,
    dialogue: null,
    banner: null,
    camera: { x: 0, y: 0 },
    cars: [],
    people: [],
    bullets: [],
    particles: [],
    pickups: [],
    pickupTimer: 0,
    stats: { shotsFired: 0, carsStolen: 0, thugsDown: 0, missionsDone: 0, busted: 0 },
    autopilot: null,
    paused: false,
  };
}

// Populate traffic, pedestrians and pickups for a fresh session.
export function populateWorld(G) {
  for (let i = 0; i < CONFIG.TRAFFIC_CARS; i++) {
    const s = G.city.carSpawns[i % G.city.carSpawns.length];
    const car = spawnTrafficAt(G, s.x + rngRange(G.rng, -60, 60), s.y + rngRange(G.rng, -60, 60));
    if (car) G.cars.push(car);
  }
  // Most pedestrians wander the grid; a crowd gathers where people actually
  // are — the plaza cafe and the park — so the streets near the action are
  // never empty.
  const clustered = 20;
  for (let i = 0; i < CONFIG.PEDS - clustered; i++) {
    const x = rngRange(G.rng, 150, CONFIG.WORLD_W - 150);
    const y = rngRange(G.rng, 150, CONFIG.BEACH_Y - 60);
    G.people.push(spawnPed(G, x, y));
  }
  spawnPedCluster(G, G.city.spots.lena.x, G.city.spots.lena.y, 12);
  spawnPedCluster(G, G.city.spots.park.x, G.city.spots.park.y, 8);
  for (let i = 0; i < CONFIG.PICKUP_COUNT; i++) spawnPickup(G);
}

function spawnTrafficAt(G, x, y) {
  return spawnTrafficCar(G, x, y);
}

function spawnPickup(G) {
  const kind = G.rng() < 0.6 ? 'cash' : 'health';
  const x = rngRange(G.rng, 150, CONFIG.WORLD_W - 150);
  const y = rngRange(G.rng, 150, CONFIG.BEACH_Y - 60);
  G.pickups.push({ kind, x, y, bob: G.rng() * Math.PI * 2, value: kind === 'cash' ? 50 + Math.floor(G.rng() * 150) : 30 });
}

export function stepWorld(G, dt) {
  G.time += dt;
  G.clockMinutes += dt * 0.6;
  if (G.clockMinutes >= 24 * 60) G.clockMinutes -= 24 * 60;

  // Timers.
  if (G.banner) {
    G.banner.timer -= dt;
    if (G.banner.timer <= 0) G.banner = null;
  }
  if (G.missionComplete) {
    G.missionComplete.timer -= dt;
    if (G.missionComplete.timer <= 0) G.missionComplete = null;
  }

  // Next mission starts on its own after the breather.
  if (!G.mission && G.nextMissionAt > 0 && G.time >= G.nextMissionAt) {
    G.nextMissionAt = 0;
    startMission(G, G.nextMissionIndex);
  }

  // Shooting (mouse click or Space). On foot, and from the car too:
  // drive-by shooting is slower (see combat.js) but it is still shooting.
  const input = G.input;
  if (input.mouseDown || input.down('Space')) tryShoot(G);

  // Player.
  updatePlayer(G, dt);

  // Traffic and police cars.
  for (const car of G.cars) {
    if (car.driver === 'traffic' || car.driver === 'parked') updateTrafficCar(G, car, dt);
    else if (car.driver === 'police') updatePoliceCar(G, car, dt);
  }
  resolveCarBumps(G);

  // People.
  for (const person of G.people) {
    if (person.kind === 'ped') updatePed(G, person, dt);
    else if (person.kind === 'cop') updateFootCop(G, person, dt);
    else if (person.kind === 'thug') updateThug(G, person, dt);
  }
  G.people = G.people.filter((p) => !(p.dead && p.deadTimer > 6));

  // Player car running over pedestrians. Thugs take no run-over damage and
  // dodge cars (see people.js): the beach crew has to be shot, not driven
  // over. Bystanders still count against Rio.
  const pc = playerCar(G);
  if (pc && Math.abs(pc.speed) > 60) {
    for (const person of G.people) {
      if (person.dead) continue;
      if (person.kind === 'thug') continue;
      const d = Math.hypot(person.x - pc.x, person.y - pc.y);
      if (d < 24) {
        person.dead = true;
        person.deadTimer = 0;
        person.health = 0;
        if (person.kind === 'ped') {
          addWanted(G, 1, 'You ran over a bystander');
        }
      }
    }
  }

  // Bullets and particles.
  updateBullets(G, dt);
  updateParticles(G, dt);

  // Smoking wrecks puff.
  for (const car of G.cars) {
    if (car.smoke > 0 && G.rng() < 0.3) spawnSmoke(G, car.x, car.y);
  }

  // Wrecked cars get towed after 20 seconds instead of smoking in the lane
  // forever while traffic queues behind them. The player's own car is never
  // towed out from under him (he bails out when it wrecks, so it is not his
  // car by the time the timer runs out).
  for (const car of G.cars) {
    if (car.smoke > 0) car.wreckTimer += dt;
  }
  G.cars = G.cars.filter((car) => !(car.smoke > 0 && car.wreckTimer > 20 && car !== G.player.car));

  // Wanted level: decay when no police can see the player.
  updateWanted(G, dt);

  // Pickups: spawn over time, collect on touch.
  G.pickupTimer -= dt;
  if (G.pickupTimer <= 0 && G.pickups.length < CONFIG.PICKUP_COUNT + 2) {
    G.pickupTimer = 6;
    spawnPickup(G);
  }
  for (const pk of G.pickups) {
    pk.bob += dt * 3;
    const d = Math.hypot(pk.x - G.player.x, pk.y - G.player.y);
    if (d < 32) {
      pk.taken = true;
      if (pk.kind === 'cash') {
        G.player.money += pk.value;
        G.banner = { text: 'Picked up $' + pk.value + ' in street cash.', timer: 2 };
      } else {
        G.player.health = Math.min(100, G.player.health + pk.value);
        G.banner = { text: 'First aid — health up.', timer: 2 };
      }
      G.audio.blip(880);
    }
  }
  G.pickups = G.pickups.filter((pk) => !pk.taken);

  // Missions.
  updateMission(G, dt);

  // Repeatable fares in free roam, once the story is done.
  if (!G.mission && G.storyComplete && !G.fare && G.time >= G.nextFareAt) {
    startFare(G);
  }
  if (G.fare) updateFare(G, dt);

  // Camera follows the player, clamped to the city.
  const tx = G.player.x - CONFIG.VIEW_W / 2;
  const ty = G.player.y - CONFIG.VIEW_H / 2;
  G.camera.x += (tx - G.camera.x) * Math.min(1, 6 * dt);
  G.camera.y += (ty - G.camera.y) * Math.min(1, 6 * dt);
  G.camera.x = Math.max(0, Math.min(CONFIG.WORLD_W - CONFIG.VIEW_W, G.camera.x));
  G.camera.y = Math.max(0, Math.min(CONFIG.WORLD_H - CONFIG.VIEW_H, G.camera.y));

  // Engine hum follows speed; sirens wail while wanted.
  G.audio.setWanted(G.wanted > 0);
}

// Simple bumper-car resolution between cars so traffic does not overlap.
// Traffic cars live on the road grid, so they are pushed in road
// coordinates (along the road, across the lane); free cars move in x/y.
function resolveCarBumps(G) {
  const cars = G.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      // v2: traffic cars get separated too. The old code skipped
      // traffic-traffic pairs, so two cars in one lane could end up
      // bumper-to-bumper; the follow logic alone did not always hold them
      // apart. pushCarApart moves traffic cars in road coordinates.
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = 34;
      if (d > 0 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        // The player's car is heavy: it barely moves in a bump, the other
        // car takes most of the push, so a police ram cannot shove Rio
        // sideways off the road into a building.
        const aWeight = a.driver === 'player' ? 0.3 : b.driver === 'player' ? 1.7 : 1;
        const bWeight = b.driver === 'player' ? 0.3 : a.driver === 'player' ? 1.7 : 1;
        pushCarApart(a, -nx * push * aWeight, -ny * push * aWeight);
        pushCarApart(b, nx * push * bWeight, ny * push * bWeight);
      }
    }
  }
}

function pushCarApart(car, px, py) {
  if (car.driver === 'traffic' || car.driver === 'parked') {
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    const rx = -Math.sin(car.angle);
    const ry = Math.cos(car.angle);
    car.along += px * fx + py * fy;
    car.perp += px * rx + py * ry;
    car.perp = Math.max(-30, Math.min(60, car.perp));
  } else {
    car.x += px;
    car.y += py;
    if (car.driver === 'player') car.speed *= 0.98;
  }
}

function updateWanted(G, dt) {
  if (G.wanted <= 0) return;
  // Can any police unit see the player?
  let seen = false;
  for (const car of G.cars) {
    if (car.driver !== 'police') continue;
    if (Math.hypot(car.x - G.player.x, car.y - G.player.y) < CONFIG.POLICE.sightRange) {
      seen = true;
      break;
    }
  }
  if (!seen) {
    for (const person of G.people) {
      if (person.kind !== 'cop') continue;
      if (Math.hypot(person.x - G.player.x, person.y - G.player.y) < 420) {
        seen = true;
        break;
      }
    }
  }
  if (seen) {
    G.wantedTimer = CONFIG.WANTED.decaySeconds;
  } else {
    G.wantedTimer -= dt;
    if (G.wantedTimer <= 0) {
      G.wanted -= 1;
      G.wantedTimer = CONFIG.WANTED.decaySeconds;
      if (G.wanted === 0) G.banner = { text: 'You lost the cops. Stay clean, Rio.', timer: 3 };
    }
  }

  // Keep the right number of police units on the street.
  const wantCruisers = Math.min(G.wanted, 4);
  const cruisers = G.cars.filter((c) => c.driver === 'police').length;
  if (cruisers < wantCruisers) spawnPoliceCar(G);
  if (cruisers > wantCruisers + 1) {
    const extra = G.cars.find((c) => c.driver === 'police');
    if (extra) G.cars.splice(G.cars.indexOf(extra), 1);
  }
  const wantCops = G.wanted >= 3 ? 2 : 0;
  const cops = G.people.filter((p) => p.kind === 'cop' && !p.dead).length;
  if (cops < wantCops) spawnFootCop(G);
}
