// Solmar Heat — staged screenshot scenes.
// Each shot plays the real simulation forward with a scripted autopilot, so
// the screenshots show the actual game: a lively city, driving, a police
// chase, a mission in progress. Called with ?shot=<name>&seed=1.
// After staging, main.js renders without stepping the world, then sets
// window.__shotReady so a headless check can see the scene is painted.

import { CONFIG } from './config.js';
import { stepWorld, STEP } from './world.js';
import { startMission } from './missions.js';
import { giveCar } from './player.js';
import { spawnPoliceCar } from './missions.js';

// Steer the player's car toward a target: hold W, steer with A/D, and brake
// for sharp turns so the car turns tightly instead of clipping corners.
function autopilotDrive(G, target) {
  const from = G.player.inCar ? G.player.car : G.player;
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const want = Math.atan2(dy, dx);
  let diff = want - from.angle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  const keys = G.input.keys;
  keys.delete('Space');
  if (Math.abs(diff) > 0.55) {
    // Sharp turn ahead: brake so the turn stays on the road.
    keys.delete('KeyW');
    keys.add('KeyS');
  } else {
    keys.add('KeyW');
    keys.delete('KeyS');
  }
  if (diff > 0.08) {
    keys.add('KeyD');
    keys.delete('KeyA');
  } else if (diff < -0.08) {
    keys.add('KeyA');
    keys.delete('KeyD');
  } else {
    keys.delete('KeyA');
    keys.delete('KeyD');
  }
}

function runSteps(G, count, targetFn) {
  for (let i = 0; i < count; i++) {
    if (targetFn) autopilotDrive(G, targetFn(G));
    stepWorld(G, STEP);
    G.input.clearPressed();
  }
  G.input.keys.clear();
}

// Waypoint route: drive through each point in turn (for the mission shot).
function waypointTarget(waypoints) {
  let leg = 0;
  return (G) => {
    const from = G.player.inCar ? G.player.car : G.player;
    const t = waypoints[Math.min(leg, waypoints.length - 1)];
    if (Math.hypot(t.x - from.x, t.y - from.y) < 70 && leg < waypoints.length - 1) leg += 1;
    return waypoints[Math.min(leg, waypoints.length - 1)];
  };
}

// Let the city live for a while without the player doing anything.
function ambientSteps(G, count) {
  runSteps(G, count, null);
}

export function stageShot(G, name) {
  const city = G.city;
  const spots = city.spots;

  if (name === 'start') {
    // Title screen over a lively city: Rio on foot by the plaza.
    G.player.x = spots.lena.x + 40;
    G.player.y = spots.lena.y + 60;
    G.player.angle = -Math.PI / 2;
    G.camera.x = G.player.x - CONFIG.VIEW_W / 2;
    G.camera.y = G.player.y - CONFIG.VIEW_H / 2;
    ambientSteps(G, 600);
    G.screen = 'title';
    return;
  }

  if (name === 'drive') {
    // Rio driving a sports car straight down Coral Avenue, traffic around
    // him, mission 1 live so the objective arrow points at Lena.
    const x = city.avenues[3];
    const y = city.streets[2];
    giveCar(G, 'sports', x, y, Math.PI / 2);
    G.player.car.speed = 260;
    startMission(G, 0);
    G.screen = 'play';
    // Southbound lane is x = avenue - 20; stop mid-city, still at speed.
    runSteps(G, 150, () => ({ x: city.avenues[3] - 20, y: city.streets[6] }));
    return;
  }

  if (name === 'chase') {
    // Wanted level 3: three cruisers in a line right on Rio's tail as he
    // flees east along Marina Street.
    const x = city.avenues[2];
    const y = city.streets[4];
    giveCar(G, 'sports', x, y, 0);
    G.player.car.speed = 380;
    G.wanted = 3;
    G.wantedTimer = CONFIG.WANTED.decaySeconds;
    for (let i = 0; i < 3; i++) {
      const cop = spawnPoliceCar(G);
      cop.x = x - 130 - i * 80;
      cop.y = y + 20;
      cop.angle = 0;
      cop.speed = 360;
    }
    G.banner = { text: 'Wanted level 3 — lose the Solmar PD!', timer: 60 };
    G.screen = 'play';
    // Eastbound lane is y = street + 20. Stop mid-flight, still at speed —
    // the target is far ahead so the car never turns around for it.
    runSteps(G, 130, () => ({ x: city.avenues[6], y: city.streets[4] + 20 }));
    return;
  }

  if (name === 'mission') {
    // Mission 2 in progress: package in hand, delivery across town, wanted 2,
    // Lena talking on the radio, objective arrow pointing at the drop-off.
    // The car follows the roads: west along Palm Street, then south to Marina.
    const x = city.avenues[5];
    const y = city.streets[2];
    giveCar(G, 'sedan', x, y, Math.PI);
    G.player.car.speed = 240;
    startMission(G, 1);
    G.mission.stage = 1;
    G.mission.packageTaken = true;
    G.mission.target = spots.delivery;
    G.mission.targetLabel = 'Deliver the package';
    G.wanted = 2;
    G.wantedTimer = CONFIG.WANTED.decaySeconds;
    const cop = spawnPoliceCar(G);
    cop.x = x + 200;
    cop.y = y + 120;
    cop.speed = 320;
    G.dialogue = {
      lines: ['Lena Cruz: Cops are moving in. Do not stop, Rio — the drop-off is on Marina Street.'],
      line: 0,
      timer: 60,
    };
    G.screen = 'play';
    runSteps(
      G,
      260,
      waypointTarget([
        { x: city.avenues[1], y: city.streets[2] - 20 },
        { x: city.avenues[1] - 20, y: city.streets[5] },
      ]),
    );
    return;
  }

  // Unknown shot name: fall back to the title scene.
  G.screen = 'title';
  ambientSteps(G, 300);
}
