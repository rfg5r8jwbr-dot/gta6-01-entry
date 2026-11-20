// Solmar Heat — story missions and free roam.
// Three jobs for Rio Calder, handed out by Lena Cruz, the fixer who runs
// Solmar from a plaza cafe table. Each mission has stages with an objective,
// a map target and dialogue; finishing one pays out and unlocks the next.

import { CONFIG } from './config.js';
import { makeFootCop, makeThug } from './people.js';
import { makeCar } from './vehicles.js';

export const MISSIONS = [
  {
    id: 'first-wheels',
    name: 'M1 — First Wheels',
    giver: 'Lena Cruz',
    briefing: [
      'Lena Cruz: Rio, welcome back to Solmar. First rule: nobody walks here.',
      'Lena Cruz: Grab any car on the street — press E next to one — then bring it to me at the plaza.',
    ],
    reward: CONFIG.REWARD_M1,
  },
  {
    id: 'the-pickup',
    name: 'M2 — The Pickup',
    giver: 'Lena Cruz',
    briefing: [
      'Lena Cruz: A package is waiting on Coral Avenue. Pick it up and run it to the drop-off on Marina Street.',
      'Lena Cruz: The client is impatient, and so is the PD. Expect company.',
    ],
    reward: CONFIG.REWARD_M2,
  },
  {
    id: 'beachfront-heat',
    name: 'M3 — Beachfront Heat',
    giver: 'Mr. Delgado',
    briefing: [
      'Mr. Delgado: My boys on the beach have gone loud, Rio. Clear them out, then lose the cops and get to the hideout.',
      'Lena Cruz: Four of them, armed. Watch the sand — nowhere to hide down there.',
    ],
    reward: CONFIG.REWARD_M3,
  },
];

export function startMission(G, index) {
  const def = MISSIONS[index];
  G.mission = {
    index,
    def,
    stage: 0,
    target: null,
    targetLabel: '',
    done: false,
    thugsSpawned: false,
    packageTaken: false,
  };
  G.dialogue = { lines: def.briefing.slice(), line: 0, timer: 4.5 };
  G.banner = { text: def.name + ' — ' + def.giver, timer: 3 };
  setMissionStage(G);
  G.audio.jingle('mission');
}

// Point the objective arrow at the current stage target.
export function setMissionStage(G) {
  const m = G.mission;
  const spots = G.city.spots;
  if (!m) return;
  if (m.index === 0) {
    if (m.stage === 0) {
      m.target = null;
      m.targetLabel = 'Steal any car (E)';
    } else {
      m.target = spots.lena;
      m.targetLabel = "Drive to Lena at the plaza";
    }
  } else if (m.index === 1) {
    if (m.stage === 0) {
      m.target = spots.package;
      m.targetLabel = 'Pick up the package';
    } else {
      m.target = spots.delivery;
      m.targetLabel = 'Deliver the package';
    }
  } else if (m.index === 2) {
    if (m.stage === 0) {
      m.target = spots.beach;
      m.targetLabel = 'Reach the beachfront';
    } else if (m.stage === 1) {
      m.target = spots.beach;
      m.targetLabel = 'Take down the beach crew (0/4)';
    } else {
      m.target = spots.hideout;
      m.targetLabel = 'Lose the cops — reach the hideout';
    }
  }
}

function distTo(G, target) {
  return Math.hypot(G.player.x - target.x, G.player.y - target.y);
}

export function updateMission(G, dt) {
  const m = G.mission;
  if (!m) return;
  // Advance dialogue lines on a timer.
  if (G.dialogue) {
    G.dialogue.timer -= dt;
    if (G.dialogue.timer <= 0) {
      G.dialogue.line += 1;
      G.dialogue.timer = 4.5;
      if (G.dialogue.line >= G.dialogue.lines.length) G.dialogue = null;
    }
  }
  const spots = G.city.spots;

  if (m.index === 0) {
    if (m.stage === 0 && G.player.inCar) {
      m.stage = 1;
      setMissionStage(G);
      G.banner = { text: 'Good — now bring it to Lena at the plaza.', timer: 3 };
    } else if (m.stage === 1 && distTo(G, spots.lena) < 95) {
      completeMission(G);
    }
  } else if (m.index === 1) {
    if (m.stage === 0 && distTo(G, spots.package) < 70) {
      m.stage = 1;
      m.packageTaken = true;
      setMissionStage(G);
      G.wanted = Math.max(G.wanted, 2);
      G.wantedTimer = CONFIG.WANTED.decaySeconds;
      G.banner = { text: 'Package secured — the PD is onto you. Deliver it!', timer: 3 };
      G.audio.sirenBurst();
      G.dialogue = { lines: ['Lena Cruz: Cops are moving in. Do not stop, Rio.'], line: 0, timer: 4.5 };
    } else if (m.stage === 1 && distTo(G, spots.delivery) < 95) {
      completeMission(G);
    }
  } else if (m.index === 2) {
    if (m.stage === 0 && distTo(G, spots.beach) < 110) {
      m.stage = 1;
      setMissionStage(G);
      if (!m.thugsSpawned) {
        m.thugsSpawned = true;
        const bx = spots.beach.x;
        const by = spots.beach.y;
        G.people.push(makeThug(G, bx - 90, by + 20));
        G.people.push(makeThug(G, bx + 60, by - 30));
        G.people.push(makeThug(G, bx + 120, by + 40));
        G.people.push(makeThug(G, bx - 30, by + 70));
      }
      G.wanted = Math.max(G.wanted, 3);
      G.wantedTimer = CONFIG.WANTED.decaySeconds;
      G.banner = { text: 'The beach crew is here — take them down!', timer: 3 };
      G.audio.sirenBurst();
    } else if (m.stage === 1) {
      const alive = G.people.filter((p) => p.kind === 'thug' && !p.dead).length;
      m.targetLabel = 'Take down the beach crew (' + (4 - alive) + '/4)';
      if (alive === 0) {
        m.stage = 2;
        setMissionStage(G);
        G.banner = { text: 'Crew down — get wheels and reach the hideout!', timer: 3 };
        G.dialogue = { lines: ['Lena Cruz: Hideout is on the east side. Lose them first if you can.'], line: 0, timer: 4.5 };
      }
    } else if (m.stage === 2 && distTo(G, spots.hideout) < 95) {
      completeMission(G);
    }
  }
}

function completeMission(G) {
  const m = G.mission;
  G.player.money += m.def.reward;
  G.missionsDone.push(m.def.id);
  G.stats.missionsDone += 1;
  G.missionComplete = { text: m.def.name + ' COMPLETE', reward: m.def.reward, timer: 4 };
  G.banner = { text: 'Mission complete — $' + m.def.reward + ' paid.', timer: 3.5 };
  G.audio.jingle('complete');
  G.mission = null;
  // Start the next job after a breather, or open free roam.
  if (m.index + 1 < MISSIONS.length) {
    G.nextMissionAt = G.time + 5;
    G.nextMissionIndex = m.index + 1;
  } else {
    G.storyComplete = true;
    G.dialogue = {
      lines: [
        'Lena Cruz: That is the whole job, Rio. Solmar is yours now — keep the money coming.',
        'Free roam: explore the city, steal cars, outrun the PD. Your progress is saved.',
      ],
      line: 0,
      timer: 5,
    };
  }
}

// Spawn a police cruiser near the player, on a road.
export function spawnPoliceCar(G) {
  const angle = G.rng() * Math.PI * 2;
  const dist = 700;
  let x = G.player.x + Math.cos(angle) * dist;
  let y = G.player.y + Math.sin(angle) * dist;
  x = Math.max(120, Math.min(CONFIG.WORLD_W - 120, x));
  y = Math.max(120, Math.min(CONFIG.WORLD_H - 120, y));
  const car = makeCar('police', x, y, Math.atan2(G.player.y - y, G.player.x - x));
  car.driver = 'police';
  car.speed = 200;
  G.cars.push(car);
  return car;
}

export function spawnFootCop(G) {
  const angle = G.rng() * Math.PI * 2;
  const dist = 420;
  let x = G.player.x + Math.cos(angle) * dist;
  let y = G.player.y + Math.sin(angle) * dist;
  x = Math.max(60, Math.min(CONFIG.WORLD_W - 60, x));
  y = Math.max(60, Math.min(CONFIG.SEA_Y - 30, y));
  const cop = makeFootCop(G, x, y);
  G.people.push(cop);
  return cop;
}
