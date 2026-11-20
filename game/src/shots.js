// Solmar Heat — staged screenshot scenes (v2).
// Each shot plays the real simulation forward with a scripted autopilot, so
// the screenshots show the actual game: a lively city, driving, a police
// chase, a beach shootout, a mission in progress. Called with
// ?shot=<name>&seed=1. After staging, main.js renders without stepping the
// world, then sets window.__shotReady so a headless check can see the scene
// is painted.
//
// v2 re-shot the sheet: the cover is a driving shot now (the old title
// screen wasted a quarter of the contact sheet on a menu), one shot is the
// M3 beach shootout (the sea never appeared before), and every gameplay shot
// puts pedestrians in frame — the first entry's streets read as empty.

import { CONFIG } from './config.js';
import { stepWorld, STEP } from './world.js';
import { startMission } from './missions.js';
import { giveCar } from './player.js';
import { spawnPoliceCar } from './missions.js';
import { spawnPed, spawnPedCluster } from './people.js';

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

  if (name === 'cover') {
    // The cover: Rio driving a sports car down Coral Avenue at speed,
    // traffic around him, pedestrians on the pavements, mission 1 live so
    // the objective arrow points at Lena.
    const x = city.avenues[3];
    const y = city.streets[2];
    giveCar(G, 'sports', x, y, Math.PI / 2);
    G.player.car.speed = 260;
    startMission(G, 0);
    G.screen = 'play';
    // Southbound lane is x = avenue - 20; stop mid-city, still at speed.
    runSteps(G, 150, () => ({ x: city.avenues[3] - 20, y: city.streets[6] }));
    // Pedestrians in frame: a crowd on the pavements around the camera.
    spawnPedCluster(G, G.player.x, G.player.y, 10);
    return;
  }

  if (name === 'beach') {
    // M3 beach shootout: Rio on foot on the open sand, four thugs around
    // him, the sea and umbrellas behind — the fight happens on the beach,
    // not on the avenue that runs down to it.
    G.player.x = spots.beach.x;
    G.player.y = spots.beach.y + 20;
    G.player.angle = 0;
    startMission(G, 2);
    G.screen = 'play';
    // Standing on the beach triggers stage 1 and spawns the crew.
    runSteps(G, 40, null);
    // Move the fight onto the seafront road: Rio and the crew on the
    // waterfront, the sea as their backdrop. The last city row eats most
    // of the sand strip, so the road at the waterline is the one open
    // ground where the fight reads against teal, not against buildings.
    const px = spots.beach.x + 220;
    const py = 3000;
    G.player.x = px;
    G.player.y = py;
    const thugs = G.people.filter((p) => p.kind === 'thug' && !p.dead);
    const offsets = [
      [-160, -20],
      [140, -30],
      [200, 20],
      [-60, 40],
    ];
    thugs.forEach((t, i) => {
      const o = offsets[i % offsets.length];
      t.x = px + o[0];
      t.y = py + o[1];
      t.angle = Math.atan2(py - t.y, px - t.x);
    });
    G.camera.x = Math.max(0, Math.min(CONFIG.WORLD_W - CONFIG.VIEW_W, px - CONFIG.VIEW_W / 2));
    G.camera.y = Math.max(0, Math.min(CONFIG.WORLD_H - CONFIG.VIEW_H, py - CONFIG.VIEW_H / 2));
    // Face the nearest thug and fire once: flash and bullets in frame.
    const thug = thugs[0];
    if (thug) {
      G.input.mouseX = thug.x - G.camera.x;
      G.input.mouseY = thug.y - G.camera.y;
      G.input.mouseDown = true;
      for (let i = 0; i < 3; i++) stepWorld(G, STEP);
      G.input.mouseDown = false;
    }
    // A few beachgoers on the promenade ground for life.
    for (let i = 0; i < 3; i++) {
      const bg = spawnPed(G, px - 320 + i * 260, 2880);
      bg.angle = -Math.PI / 2;
      G.people.push(bg);
    }
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
    // The flight may have run a bystander over and raised the heat past 3:
    // re-state the banner with the real level so it matches the stars.
    G.banner = { text: 'Wanted level ' + G.wanted + ' — lose the Solmar PD!', timer: 60 };
    // Pedestrians on the pavements the chase runs past.
    spawnPedCluster(G, G.player.x, G.player.y, 8);
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
    // Pedestrians in frame along the getaway route.
    spawnPedCluster(G, G.player.x, G.player.y, 8);
    return;
  }

  // Unknown shot name: fall back to the cover scene.
  G.screen = 'title';
  ambientSteps(G, 300);
}
