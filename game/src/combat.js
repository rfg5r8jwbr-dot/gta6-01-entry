// Solmar Heat — combat: shooting, bullets, damage and the police response.
// The player shoots toward the mouse (or his facing on foot); bullets hit
// buildings, cars and people, and every loud shot makes the city notice.

import { CONFIG } from './config.js';
import { addWanted } from './player.js';
import { pointInBuilding } from './city.js';
import { spawnSparks } from './vehicles.js';

export function tryShoot(G) {
  const p = G.player;
  if (p.inCar) return;
  if (G.fireCooldown > 0) return;
  G.fireCooldown = CONFIG.COMBAT.fireRate;
  const aim = G.input.mouseWorld(G);
  const angle = Math.atan2(aim.y - p.y, aim.x - p.x);
  p.angle = angle;
  const bx = p.x + Math.cos(angle) * 20;
  const by = p.y + Math.sin(angle) * 20;
  G.bullets.push({
    x: bx,
    y: by,
    vx: Math.cos(angle) * CONFIG.COMBAT.bulletSpeed,
    vy: Math.sin(angle) * CONFIG.COMBAT.bulletSpeed,
    life: CONFIG.COMBAT.bulletLife,
    from: 'player',
    damage: CONFIG.COMBAT.playerDamage,
  });
  // Muzzle flash and noise: the city hears this.
  G.particles.push({
    kind: 'flash',
    x: bx,
    y: by,
    vx: 0,
    vy: 0,
    life: 0.08,
    maxLife: 0.08,
  });
  G.combatNoise = 1;
  G.audio.gunshot(0.8);
  G.stats.shotsFired += 1;
  addWanted(G, 0, '');
  G.wantedTimer = CONFIG.WANTED.decaySeconds;
  if (G.wanted < 1) {
    G.wanted = 1;
    G.banner = { text: 'Shots fired — the Solmar PD is on its way!', timer: 2.5 };
    G.audio.sirenBurst();
  }
}

export function updateBullets(G, dt) {
  for (const b of G.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    // Buildings stop bullets.
    if (pointInBuilding(G.city, b.x, b.y, 0)) {
      b.life = 0;
      spawnSparks(G, b.x, b.y);
      continue;
    }
    // Cars take damage.
    for (const car of G.cars) {
      if (b.life <= 0) break;
      const dx = b.x - car.x;
      const dy = b.y - car.y;
      const ca = Math.cos(-car.angle);
      const sa = Math.sin(-car.angle);
      const lx = dx * ca - dy * sa;
      const ly = dx * sa + dy * ca;
      if (Math.abs(lx) < car.model.len / 2 + 2 && Math.abs(ly) < car.model.wid / 2 + 2) {
        b.life = 0;
        car.health -= b.damage;
        spawnSparks(G, b.x, b.y);
        if (car.health <= 0) {
          car.health = 0;
          car.smoke = 1;
          if (car.driver === 'player') {
            // Car wrecked: Rio bails out on foot.
            G.player.inCar = false;
            G.player.car = null;
            G.banner = { text: 'Your ride is wrecked — run!', timer: 2.5 };
          }
        }
      }
    }
    if (b.life <= 0) continue;
    // People take damage.
    for (const person of G.people) {
      if (b.life <= 0 || person.dead) break;
      const d = Math.hypot(b.x - person.x, b.y - person.y);
      if (d < 13) {
        b.life = 0;
        person.health -= b.damage;
        G.particles.push({
          kind: 'blood',
          x: person.x,
          y: person.y,
          vx: 0,
          vy: 0,
          life: 0.5,
          maxLife: 0.5,
        });
        if (person.health <= 0) {
          person.dead = true;
          person.deadTimer = 0;
          if (person.kind === 'ped' && b.from === 'player') {
            addWanted(G, 1, 'You hit a bystander');
          } else if (person.kind === 'cop' && b.from === 'player') {
            addWanted(G, 1, 'You took down an officer');
          } else if (person.kind === 'thug' && b.from === 'player') {
            G.stats.thugsDown += 1;
          }
        }
      }
    }
    // The player can be shot by thugs and cops.
    if (b.from !== 'player' && b.life > 0 && !G.player.inCar) {
      const d = Math.hypot(b.x - G.player.x, b.y - G.player.y);
      if (d < 14) {
        b.life = 0;
        G.player.health -= b.damage;
        G.player.invuln = 0.2;
        if (G.player.health <= 0) {
          G.player.health = 0;
          G.screen = 'wasted';
          G.audio.jingle('wasted');
        }
      }
    }
  }
  G.bullets = G.bullets.filter((b) => b.life > 0);
  if (G.fireCooldown > 0) G.fireCooldown -= dt;
  if (G.combatNoise > 0) G.combatNoise = Math.max(0, G.combatNoise - dt * 0.7);
}

export function updateParticles(G, dt) {
  for (const pt of G.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
  }
  G.particles = G.particles.filter((pt) => pt.life > 0);
}
