// Solmar Heat — boot, game loop, screens, shot staging and self-test.
// Loads the city, wires input and audio, runs the fixed-step simulation and
// draws every frame. ?shot=<name>&seed=1 stages a screenshot scene;
// ?selftest=1 runs a scripted play-through and reports PASS/FAIL in the title.

import { CONFIG } from './config.js';
import { createRng } from './random.js';
import { generateCity } from './city.js';
import { createWorld, populateWorld, stepWorld, STEP } from './world.js';
import { makePlayer } from './player.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { render } from './render.js';
import { stageShot } from './shots.js';
import { loadSave, writeSave } from './save.js';
import { startMission } from './missions.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function fitCanvas() {
  const scale = Math.min(window.innerWidth / CONFIG.VIEW_W, window.innerHeight / CONFIG.VIEW_H);
  canvas.style.width = Math.floor(CONFIG.VIEW_W * scale) + 'px';
  canvas.style.height = Math.floor(CONFIG.VIEW_H * scale) + 'px';
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

function createGame(seed) {
  const rng = createRng(seed);
  const city = generateCity(rng);
  const G = createWorld(seed);
  G.rng = rng;
  G.city = city;
  G.input = new Input(canvas);
  G.audio = new AudioSys();
  G.player = makePlayer(G);
  G.saveData = loadSave();
  G.camera.x = Math.max(0, Math.min(CONFIG.WORLD_W - CONFIG.VIEW_W, G.player.x - CONFIG.VIEW_W / 2));
  G.camera.y = Math.max(0, Math.min(CONFIG.WORLD_H - CONFIG.VIEW_H, G.player.y - CONFIG.VIEW_H / 2));
  populateWorld(G);
  G.input.onFirstGesture = () => G.audio.ensure();
  return G;
}

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || '1') || 1;
const shotName = params.get('shot');
const selftest = params.get('selftest') === '1';
const G = createGame(seed);
window.__game = G;

// --- Self-test: a scripted play-through, reported in the document title. ---
function runSelftest() {
  const checks = {};
  const debugMid = {};
  try {
    checks.worldBuilt = G.city.buildings.length > 20 && G.cars.length >= 10 && G.people.length >= 10;
    checks.playerSpawn = G.player.health === 100 && G.player.money === 250;
    // Walk for 2 seconds.
    for (let i = 0; i < 120; i++) {
      G.input.keys.add('KeyW');
      stepWorld(G, STEP);
    }
    G.input.keys.clear();
    checks.walked = Math.hypot(G.player.x - G.city.spots.start.x, G.player.y - G.city.spots.start.y) > 100;
    // Steal the nearest car (walk up to it first so the steal is real).
    let near = G.cars.find((c) => Math.hypot(c.x - G.player.x, c.y - G.player.y) < 400);
    if (!near) {
      near = G.cars.reduce((a, b) =>
        Math.hypot(a.x - G.player.x, a.y - G.player.y) < Math.hypot(b.x - G.player.x, b.y - G.player.y) ? a : b,
      );
    }
    if (near) {
      G.player.x = near.x;
      G.player.y = near.y;
      G.input.pressedKeys.add('KeyE');
      stepWorld(G, STEP);
      G.input.clearPressed();
    }
    checks.stoleCar = G.player.inCar === true;
    // Drive for 3 seconds.
    for (let i = 0; i < 180; i++) {
      G.input.keys.add('KeyW');
      stepWorld(G, STEP);
    }
    G.input.keys.clear();
    checks.drove = G.player.car ? Math.abs(G.player.car.speed) > 50 : false;
    debugMid.droveSpeed = G.player.car ? Math.round(G.player.car.speed) : null;
    debugMid.droveCar = G.player.car ? G.player.car.type + '@' + Math.round(G.player.car.x) + ',' + Math.round(G.player.car.y) + ' a=' + G.player.car.angle.toFixed(2) : null;
    // Mission 1: stealing a car starts it, driving to Lena finishes it.
    // Park the car on the road just south of the plaza so the drive is short.
    startMission(G, 0);
    if (G.player.car) {
      G.player.car.x = G.city.spots.lena.x;
      G.player.car.y = G.city.spots.lena.y + 160;
      G.player.car.angle = -Math.PI / 2;
      G.player.car.speed = 0;
      G.player.x = G.player.car.x;
      G.player.y = G.player.car.y;
    }
    for (let i = 0; i < 600 && G.mission; i++) {
      const t = G.city.spots.lena;
      const from = G.player.car || G.player;
      const want = Math.atan2(t.y - from.y, t.x - from.x);
      let diff = want - from.angle;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      G.input.keys.add('KeyW');
      if (diff > 0.15) G.input.keys.add('KeyD');
      else if (diff < -0.15) G.input.keys.add('KeyA');
      stepWorld(G, STEP);
      G.input.clearPressed();
    }
    G.input.keys.clear();
    checks.mission1 = G.missionsDone.includes('first-wheels');
    // Shooting raises the wanted level.
    G.input.mouseX = CONFIG.VIEW_W / 2 + 100;
    G.input.mouseY = CONFIG.VIEW_H / 2;
    G.player.inCar = false;
    G.player.car = null;
    G.input.mouseDown = true;
    for (let i = 0; i < 30; i++) stepWorld(G, STEP);
    G.input.mouseDown = false;
    checks.wanted = G.wanted >= 1;
    checks.bullets = G.stats.shotsFired > 0;
    // Police respond to the wanted level.
    for (let i = 0; i < 300; i++) stepWorld(G, STEP);
    checks.policeSpawned = G.cars.some((c) => c.driver === 'police');
    // Save round-trips.
    writeSave(G);
    checks.save = loadSave() !== null;
    // Render once without throwing.
    render(G, ctx);
    checks.rendered = true;
  } catch (err) {
    checks.error = String(err && err.message ? err.message : err);
  }
  const failed = Object.entries(checks).filter(([, v]) => v !== true).map(([k]) => k);
  const summary = {
    pass: failed.length === 0,
    failed,
    checks,
    debug: {
      inCar: G.player.inCar,
      carType: G.player.car ? G.player.car.type : null,
      carSpeed: G.player.car ? Math.round(G.player.car.speed) : null,
      carPos: G.player.car ? [Math.round(G.player.car.x), Math.round(G.player.car.y)] : null,
      playerPos: [Math.round(G.player.x), Math.round(G.player.y)],
      wanted: G.wanted,
      cars: G.cars.length,
      ...debugMid,
    },
  };
  window.__selftest = summary;
  document.title = failed.length === 0 ? 'SELFTEST PASS' : 'SELFTEST FAIL: ' + failed.join(',');
  document.documentElement.setAttribute('data-selftest', JSON.stringify(summary));
  return summary;
}

// --- Screens and input ---

function startPlaying() {
  G.audio.ensure();
  G.screen = 'play';
  if (!G.mission && G.missionsDone.length === 0 && G.nextMissionAt === 0) {
    G.nextMissionAt = G.time + 1.5;
    G.nextMissionIndex = 0;
  }
}

function restartAfterEnd() {
  const keepMoney = G.player.money;
  const keepMissions = G.missionsDone.slice();
  const fresh = createGame(G.seed);
  fresh.player.money = keepMoney;
  fresh.missionsDone = keepMissions;
  fresh.screen = 'play';
  Object.assign(G, fresh);
  G.input = fresh.input;
  G.audio = fresh.audio;
  if (G.missionsDone.length < 3) {
    G.nextMissionAt = G.time + 1.5;
    G.nextMissionIndex = G.missionsDone.length;
  }
}

function handleScreenInput() {
  const input = G.input;
  if (G.screen === 'title') {
    if (input.pressed('Enter') || input.clicked) startPlaying();
    if (input.pressed('KeyC') && G.saveData) {
      G.player.money = G.saveData.money;
      G.missionsDone = G.saveData.missionsDone.slice();
      startPlaying();
    }
  } else if (G.screen === 'play') {
    if (input.pressed('KeyP') || input.pressed('Escape')) {
      G.screen = 'paused';
      G.audio.setEngine(0);
    }
  } else if (G.screen === 'paused') {
    if (input.pressed('KeyP') || input.pressed('Escape') || input.pressed('Enter')) {
      G.screen = 'play';
    }
  } else if (G.screen === 'busted' || G.screen === 'wasted') {
    if (input.pressed('Enter') || input.clicked) restartAfterEnd();
  }
  if (input.pressed('KeyM')) {
    G.audio.setMuted(!G.audio.muted);
  }
}

// --- Main loop ---

let last = performance.now();
let accumulator = 0;
let framesPainted = 0;
let saveTimer = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const elapsed = Math.min(0.25, (now - last) / 1000);
  last = now;

  if (shotName) {
    // Staged scene: keep the waves and pulses alive, but do not step the
    // world, so the shot stays exactly as staged.
    G.time += elapsed;
    render(G, ctx);
    framesPainted += 1;
    if (framesPainted === 2) {
      window.__shotReady = true;
      document.documentElement.setAttribute('data-shot-ready', 'true');
      document.documentElement.setAttribute(
        'data-shot-debug',
        JSON.stringify({
          player: [Math.round(G.player.x), Math.round(G.player.y)],
          inCar: G.player.inCar,
          carSpeed: G.player.car ? Math.round(G.player.car.speed) : null,
          carAngle: G.player.car ? +G.player.car.angle.toFixed(2) : null,
          screen: G.screen,
          wanted: G.wanted,
        }),
      );
    }
    return;
  }

  handleScreenInput();
  if (G.screen === 'play') {
    accumulator += elapsed;
    while (accumulator >= STEP) {
      stepWorld(G, STEP);
      accumulator -= STEP;
    }
    G.input.clearPressed();
    saveTimer += elapsed;
    if (saveTimer > 10) {
      saveTimer = 0;
      writeSave(G);
    }
  } else {
    // Title and end screens still animate the city behind them.
    if (G.screen === 'title') {
      accumulator += elapsed;
      while (accumulator >= STEP) {
        stepWorld(G, STEP);
        accumulator -= STEP;
      }
      G.input.clearPressed();
    }
    if (G.screen !== 'play') G.input.clearPressed();
  }
  render(G, ctx);
}

// Auto-pause when the tab is hidden.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.screen === 'play') {
    G.screen = 'paused';
    G.audio.setEngine(0);
  }
});

if (selftest) {
  G.screen = 'play';
  runSelftest();
  G.screen = 'title';
}

if (shotName) {
  stageShot(G, shotName);
}

requestAnimationFrame(frame);
