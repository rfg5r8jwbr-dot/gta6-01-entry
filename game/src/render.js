// Solmar Heat — rendering: the city, the cars, the people, the effects, the
// HUD with its minimap, and every screen (title, pause, mission complete,
// busted, wasted). All Canvas 2D, all drawn from the game state.

import { CONFIG } from './config.js';
import { drawCar } from './vehicles.js';
import { drawPerson } from './people.js';
import { nearestCar } from './player.js';

const P = CONFIG.PALETTE;

export function render(G, ctx) {
  const W = CONFIG.VIEW_W;
  const H = CONFIG.VIEW_H;
  ctx.clearRect(0, 0, W, H);

  // World space.
  ctx.save();
  ctx.translate(-Math.round(G.camera.x), -Math.round(G.camera.y));
  drawGround(G, ctx);
  drawPickups(G, ctx);
  drawMissionMarkers(G, ctx);
  for (const car of G.cars) drawCar(ctx, car, G.time);
  for (const person of G.people) drawPerson(ctx, person, G.time);
  drawPlayer(G, ctx);
  drawBullets(G, ctx);
  drawParticles(G, ctx);
  ctx.restore();

  // Warm sunset light over everything: a real golden-hour gradient, warm
  // from the west and a touch cooler toward the sea, not a flat wash.
  const glow = ctx.createLinearGradient(0, 0, W, H);
  glow.addColorStop(0, 'rgba(255, 150, 60, 0.10)');
  glow.addColorStop(0.6, 'rgba(255, 140, 70, 0.06)');
  glow.addColorStop(1, 'rgba(255, 120, 90, 0.09)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  drawHud(G, ctx);
  if (G.screen === 'title') drawTitle(G, ctx);
  if (G.screen === 'paused') drawPause(G, ctx);
  if (G.screen === 'busted') drawEndScreen(G, ctx, 'BUSTED', 'The Solmar PD caught up with Rio.');
  if (G.screen === 'wasted') drawEndScreen(G, ctx, 'WASTED', 'Rio is down — but Solmar never sleeps.');
  if (G.missionComplete) drawMissionComplete(G, ctx);

  updateStatusLine(G);
}

function inView(G, x, y, margin) {
  const m = margin || 80;
  return x > G.camera.x - m && x < G.camera.x + CONFIG.VIEW_W + m && y > G.camera.y - m && y < G.camera.y + CONFIG.VIEW_H + m;
}

function drawGround(G, ctx) {
  const city = G.city;
  const cam = G.camera;
  const x0 = Math.max(0, cam.x - 100);
  const y0 = Math.max(0, cam.y - 100);
  const x1 = Math.min(CONFIG.WORLD_W, cam.x + CONFIG.VIEW_W + 100);
  const y1 = Math.min(CONFIG.WORLD_H, cam.y + CONFIG.VIEW_H + 100);

  // Dry warm ground everywhere.
  ctx.fillStyle = P.ground;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  // Beach sand and the sea on the south edge.
  ctx.fillStyle = P.sand;
  ctx.fillRect(x0, Math.max(city.beachY, y0), x1 - x0, Math.max(0, Math.min(city.seaY, y1) - Math.max(city.beachY, y0)));
  ctx.fillStyle = P.sea;
  ctx.fillRect(x0, Math.max(city.seaY, y0), x1 - x0, Math.max(0, y1 - Math.max(city.seaY, y0)));
  ctx.fillStyle = P.seaDeep;
  ctx.fillRect(x0, Math.max(city.seaY + 90, y0), x1 - x0, Math.max(0, y1 - Math.max(city.seaY + 90, y0)));
  // Animated wave lines.
  ctx.strokeStyle = P.foam;
  ctx.lineWidth = 3;
  for (let w = 0; w < 4; w++) {
    const wy = city.seaY + 14 + w * 26;
    if (wy < y0 || wy > y1) continue;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 40) {
      const yy = wy + Math.sin(x * 0.02 + G.time * 1.6 + w * 1.7) * 4;
      if (x === x0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // Beach umbrellas.
  ctx.fillStyle = '#e86a5a';
  for (let i = 0; i < 6; i++) {
    const ux = 300 + i * 480;
    const uy = city.beachY + 60 + (i % 2) * 40;
    if (!inView(G, ux, uy, 40)) continue;
    ctx.beginPath();
    ctx.arc(ux, uy, 16, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#8a6f4d';
    ctx.fillRect(ux - 1, uy, 2, 14);
    ctx.fillStyle = '#e86a5a';
  }

  // Blocks: parks, plaza, sand, and plain city ground.
  for (const b of city.blocks) {
    if (b.x1 < x0 || b.x0 > x1 || b.y1 < y0 || b.y0 > y1) continue;
    if (b.kind === 'park') {
      ctx.fillStyle = P.parkGreen;
      ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, 8);
    } else if (b.kind === 'plaza') {
      ctx.fillStyle = P.plaza;
      ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x0 + 10, b.y0 + 10, b.x1 - b.x0 - 20, b.y1 - b.y0 - 20);
      ctx.fillStyle = '#7fb8c9';
      ctx.beginPath();
      ctx.arc((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, 26, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.kind === 'sand') {
      ctx.fillStyle = P.sand;
      ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    }
  }

  // Roads: dark asphalt with lighter sidewalks and dashed centre lines.
  ctx.fillStyle = P.road;
  for (const a of city.avenues) ctx.fillRect(a - CONFIG.ROAD_W / 2, y0, CONFIG.ROAD_W, y1 - y0);
  for (const s of city.streets) ctx.fillRect(x0, s - CONFIG.ROAD_W / 2, x1 - x0, CONFIG.ROAD_W);
  ctx.strokeStyle = P.laneLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 18]);
  for (const a of city.avenues) {
    ctx.beginPath();
    ctx.moveTo(a, y0);
    ctx.lineTo(a, y1);
    ctx.stroke();
  }
  for (const s of city.streets) {
    ctx.beginPath();
    ctx.moveTo(x0, s);
    ctx.lineTo(x1, s);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Sidewalk edges.
  ctx.strokeStyle = P.sidewalk;
  ctx.lineWidth = 4;
  for (const a of city.avenues) {
    ctx.beginPath();
    ctx.moveTo(a - CONFIG.ROAD_W / 2 - 2, y0);
    ctx.lineTo(a - CONFIG.ROAD_W / 2 - 2, y1);
    ctx.moveTo(a + CONFIG.ROAD_W / 2 + 2, y0);
    ctx.lineTo(a + CONFIG.ROAD_W / 2 + 2, y1);
    ctx.stroke();
  }

  // Trees in the park.
  for (const t of city.trees) {
    if (!inView(G, t.x, t.y, 30)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(t.x + 4, t.y + 5, t.r, t.r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f7d3a';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#57a04e';
    ctx.beginPath();
    ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Buildings: shadow, wall, roof, lit windows. Shadows stretch long at
  // golden hour — nine pixels per floor, down and to the east.
  for (const b of city.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    const lift = b.height * 9;
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(b.x + lift, b.y + lift, b.w, b.h);
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    // Windows on the roof face.
    ctx.fillStyle = b.lit ? P.windowLit : P.windowDark;
    const cols = Math.max(1, Math.floor((b.w - 16) / 22));
    const rows = Math.max(1, Math.floor((b.h - 16) / 22));
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        ctx.fillRect(b.x + 10 + cx * 22, b.y + 10 + cy * 22, 10, 8);
      }
    }
    // Roof detail: a lighter border and a rooftop box for tall buildings.
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    if (b.height >= 3) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + b.w / 2 - 14, b.y + b.h / 2 - 10, 28, 20);
    }
    // Rooftop detail from city.js: a pool, AC units, or a helipad.
    if (b.detail === 'pool' && b.w > 60 && b.h > 50) {
      ctx.fillStyle = '#5fb8d8';
      ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.25, b.w * 0.45, b.h * 0.4);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.25, b.w * 0.45, 4);
    } else if (b.detail === 'ac') {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(b.x + 10, b.y + 10, 12, 10);
      ctx.fillRect(b.x + b.w - 22, b.y + b.h - 20, 12, 10);
    } else if (b.detail === 'helipad') {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x + b.w / 2, b.y + b.h / 2, Math.min(b.w, b.h) * 0.32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = 'bold ' + Math.max(10, Math.min(20, Math.min(b.w, b.h) * 0.3)) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('H', b.x + b.w / 2, b.y + b.h / 2 + 5);
    }
  }
}

function drawPickups(G, ctx) {
  for (const pk of G.pickups) {
    if (!inView(G, pk.x, pk.y, 30)) continue;
    const bob = Math.sin(pk.bob) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    if (pk.kind === 'cash') {
      ctx.fillStyle = '#2fae5f';
      ctx.fillRect(-11, -7, 22, 14);
      ctx.fillStyle = '#e8f5e9';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 4);
    } else {
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(-9, -9, 18, 18);
      ctx.fillStyle = '#d23b3b';
      ctx.fillRect(-2, -7, 4, 14);
      ctx.fillRect(-7, -2, 14, 4);
    }
    ctx.restore();
  }
}

function drawMissionMarkers(G, ctx) {
  const m = G.mission;
  if (m && m.target) {
    drawTargetRing(G, ctx, m.target);
  }
  // A live fare gets the same marker, so the passenger and the drop-off
  // are as findable as any mission target.
  if (!m && G.fare && G.fare.target) {
    drawTargetRing(G, ctx, G.fare.target);
  }
}

function drawTargetRing(G, ctx, t) {
  if (!inView(G, t.x, t.y, 60)) return;
  const pulse = 1 + Math.sin(G.time * 4) * 0.15;
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.fillStyle = 'rgba(255, 210, 62, 0.25)';
  ctx.beginPath();
  ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd23e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.moveTo(0, -44 - Math.sin(G.time * 4) * 6);
  ctx.lineTo(-10, -26 - Math.sin(G.time * 4) * 6);
  ctx.lineTo(10, -26 - Math.sin(G.time * 4) * 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPlayer(G, ctx) {
  const p = G.player;
  if (p.inCar) {
    // Drive-by aim: a dashed line from the car toward the mouse, so shooting
    // from behind the wheel reads the same as shooting on foot.
    if (G.screen === 'play') {
      const aim = G.input.mouseWorld(G);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(aim.x, aim.y);
      ctx.stroke();
      ctx.restore();
    }
    return;
  }
  // Rio on foot: teal jacket, easy to spot.
  const fake = { kind: 'rio', x: p.x, y: p.y, angle: p.angle, shirt: '#19b8a6', speed: 0, dead: false, deadTimer: 0 };
  drawPerson(ctx, fake, G.time + p.walkBob * 0.1);
  // White ring when a car is close enough to steal.
  const car = nearestCar(G, 64);
  if (car) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 26 + Math.sin(G.time * 5) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('E — STEAL CAR', p.x, p.y - 34);
    ctx.restore();
  }
  // Aim line toward the mouse while on foot.
  if (G.screen === 'play') {
    const aim = G.input.mouseWorld(G);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(aim.x, aim.y);
    ctx.stroke();
    ctx.restore();
  }
}

function drawBullets(G, ctx) {
  ctx.fillStyle = '#ffe9a8';
  for (const b of G.bullets) {
    ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
  }
}

function drawParticles(G, ctx) {
  for (const pt of G.particles) {
    const a = Math.max(0, pt.life / pt.maxLife);
    if (pt.kind === 'spark') {
      ctx.fillStyle = 'rgba(255, 220, 120, ' + a + ')';
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
    } else if (pt.kind === 'smoke') {
      ctx.fillStyle = 'rgba(70, 70, 70, ' + a * 0.5 + ')';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 10 + (1 - a) * 14, 0, Math.PI * 2);
      ctx.fill();
    } else if (pt.kind === 'flash') {
      ctx.fillStyle = 'rgba(255, 240, 170, ' + a + ')';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 14, 0, Math.PI * 2);
      ctx.fill();
    } else if (pt.kind === 'blood') {
      ctx.fillStyle = 'rgba(180, 30, 30, ' + a + ')';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ---- HUD ----

function drawHud(G, ctx) {
  const W = CONFIG.VIEW_W;
  if (G.screen === 'title') return;
  // Health + money, top left.
  panel(ctx, 14, 12, 220, 64);
  ctx.fillStyle = P.hudText;
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('RIO CALDER', 26, 34);
  ctx.fillStyle = '#3a3f4a';
  ctx.fillRect(26, 44, 150, 10);
  ctx.fillStyle = G.player.health > 30 ? '#57c465' : '#d23b3b';
  ctx.fillRect(26, 44, 150 * (G.player.health / 100), 10);
  ctx.fillStyle = '#7be382';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('$' + G.player.money.toLocaleString('en-US'), 26, 70);
  ctx.fillStyle = P.hudText;
  ctx.font = '12px sans-serif';
  ctx.fillText('HEALTH', 182, 53);

  // Wanted stars, top centre.
  const stars = G.wanted;
  ctx.font = '28px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < CONFIG.WANTED.maxStars; i++) {
    ctx.fillStyle = i < stars ? P.star : 'rgba(255,255,255,0.25)';
    const sx = W / 2 + (i - 2) * 34;
    ctx.fillText('★', sx, 44);
  }
  if (stars > 0) {
    ctx.fillStyle = '#ffb3b3';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('WANTED', W / 2, 62);
  }

  // Clock, under the minimap — on a backing panel now, so the cream text
  // never sits bare on the tan ground (it was unreadable there).
  drawMinimap(G, ctx);
  panel(ctx, W - 184, 188, 170, 50);
  const hh = Math.floor(G.clockMinutes / 60);
  const mm = Math.floor(G.clockMinutes % 60);
  ctx.fillStyle = P.hudText;
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'), W - 18, 210);
  ctx.font = '11px sans-serif';
  ctx.fillStyle = 'rgba(255,233,196,0.85)';
  ctx.fillText('SOLMAR • GOLDEN HOUR', W - 18, 228);

  // Mission objective, bottom left.
  const objective = currentObjective(G);
  panel(ctx, 14, CONFIG.VIEW_H - 64, 430, 50);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(
    G.mission ? G.mission.def.name.toUpperCase() : G.fare ? 'FARE — TAXI JOB' : 'FREE ROAM',
    26,
    CONFIG.VIEW_H - 44,
  );
  ctx.fillStyle = P.hudText;
  ctx.font = '13px sans-serif';
  ctx.fillText(objective, 26, CONFIG.VIEW_H - 26);

  // Speed, bottom right, while driving.
  if (G.player.inCar && G.player.car) {
    const mph = Math.round(Math.abs(G.player.car.speed) * 0.12);
    panel(ctx, W - 150, CONFIG.VIEW_H - 64, 136, 50);
    ctx.fillStyle = P.hudText;
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(mph), W - 52, CONFIG.VIEW_H - 28);
    ctx.font = '12px sans-serif';
    ctx.fillText('mph', W - 26, CONFIG.VIEW_H - 28);
  }

  // Objective arrow at the screen edge.
  drawObjectiveArrow(G, ctx);

  // Dialogue banner, bottom centre.
  if (G.dialogue) {
    const line = G.dialogue.lines[G.dialogue.line];
    const bw = Math.min(760, ctx.measureText(line).width + 120);
    panel(ctx, (W - bw) / 2, CONFIG.VIEW_H - 128, bw, 46);
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    const speaker = line.split(':')[0];
    ctx.fillText(speaker.toUpperCase(), (W - bw) / 2 + 18, CONFIG.VIEW_H - 108);
    ctx.fillStyle = P.hudText;
    ctx.font = '14px sans-serif';
    ctx.fillText(line.split(':').slice(1).join(':').trim(), (W - bw) / 2 + 18, CONFIG.VIEW_H - 90);
  }

  // Small banner under the stars — dropped lower so it cannot crowd the
  // WANTED label (it sat 12 px under it, pink on a busy building).
  if (G.banner) {
    ctx.fillStyle = 'rgba(12,18,32,0.72)';
    const bw = ctx.measureText(G.banner.text).width + 36;
    ctx.fillRect((W - bw) / 2, 100, bw, 28);
    ctx.fillStyle = P.hudText;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(G.banner.text, W / 2, 119);
  }

  // Mute hint — on a backing panel now, for the same reason as the clock,
  // centred at the bottom so it never sits under the speed readout.
  panel(ctx, W / 2 - 55, CONFIG.VIEW_H - 30, 110, 20);
  ctx.fillStyle = 'rgba(255,233,196,0.85)';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(G.audio.muted ? 'M — SOUND OFF' : 'M — MUTE', W / 2, CONFIG.VIEW_H - 16);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = P.hudBg;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
}

function currentObjective(G) {
  if (G.mission) return G.mission.targetLabel;
  if (G.fare) return G.fare.targetLabel + ' — $' + G.fare.reward;
  if (G.storyComplete) return 'Story complete — Solmar is yours. Run fares, explore, evade.';
  return 'Talk to Lena — start your first job (missions begin on their own).';
}

function drawObjectiveArrow(G, ctx) {
  const m = G.mission;
  const t = m ? m.target : G.fare ? G.fare.target : null;
  if (!t) return;
  const sx = t.x - G.camera.x;
  const sy = t.y - G.camera.y;
  const W = CONFIG.VIEW_W;
  const H = CONFIG.VIEW_H;
  if (sx > 40 && sx < W - 40 && sy > 40 && sy < H - 40) return;
  const cx = W / 2;
  const cy = H / 2;
  const angle = Math.atan2(sy - cy, sx - cx);
  const ax = cx + Math.cos(angle) * 300;
  const ay = cy + Math.sin(angle) * 200;
  const dist = Math.round(Math.hypot(t.x - G.player.x, t.y - G.player.y) / 10) * 10;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(angle);
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-10, -12);
  ctx.lineTo(-10, 12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(dist + 'm', ax, ay + 30);
}

function drawMinimap(G, ctx) {
  const size = 170;
  const x = CONFIG.VIEW_W - size - 14;
  const y = 12;
  const scale = size / CONFIG.WORLD_W;
  panel(ctx, x - 6, y - 6, size + 12, size + 12);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  // Sea.
  ctx.fillStyle = P.sea;
  ctx.fillRect(x, y + (CONFIG.SEA_Y - 60) * scale, size, size);
  ctx.fillStyle = P.sand;
  ctx.fillRect(x, y + CONFIG.BEACH_Y * scale, size, (CONFIG.SEA_Y - CONFIG.BEACH_Y) * scale);
  // Ground and roads.
  ctx.fillStyle = '#7d6f52';
  ctx.fillRect(x, y, size, (CONFIG.BEACH_Y * scale));
  ctx.strokeStyle = '#3a3f4a';
  ctx.lineWidth = 1;
  for (const a of G.city.avenues) {
    ctx.beginPath();
    ctx.moveTo(x + a * scale, y);
    ctx.lineTo(x + a * scale, y + size);
    ctx.stroke();
  }
  for (const s of G.city.streets) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * scale);
    ctx.lineTo(x + size, y + s * scale);
    ctx.stroke();
  }
  // Park.
  ctx.fillStyle = '#4d8a44';
  const park = G.city.blocks.find((b) => b.kind === 'park');
  if (park) ctx.fillRect(x + park.x0 * scale, y + park.y0 * scale, (park.x1 - park.x0) * scale, (park.y1 - park.y0) * scale);
  // Buildings: without them the minimap reads as an empty brown grid.
  // Each block is drawn in its roof colour, so Downtown reads denser than
  // Old Town just like the city itself.
  for (const b of G.city.buildings) {
    ctx.fillStyle = b.roof;
    ctx.fillRect(x + b.x * scale, y + b.y * scale, Math.max(1, b.w * scale), Math.max(1, b.h * scale));
  }
  // Mission target.
  if (G.mission && G.mission.target) {
    const t = G.mission.target;
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(x + t.x * scale, y + t.y * scale, 5 + Math.sin(G.time * 4) * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police dots.
  ctx.fillStyle = '#ff4d4d';
  for (const car of G.cars) {
    if (car.driver !== 'police') continue;
    ctx.beginPath();
    ctx.arc(x + car.x * scale, y + car.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  ctx.save();
  ctx.translate(x + G.player.x * scale, y + G.player.y * scale);
  ctx.rotate(G.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#20242c';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// ---- Screens ----

function drawTitle(G, ctx) {
  const W = CONFIG.VIEW_W;
  const H = CONFIG.VIEW_H;
  ctx.fillStyle = 'rgba(10, 14, 28, 0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(10, 14, 28, 0.45)';
  ctx.fillRect(0, H * 0.28, W, 300);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 84px "Arial Black", sans-serif';
  ctx.fillText('SOLMAR HEAT', W / 2, H * 0.28 + 92);
  ctx.fillStyle = '#ffe9c4';
  ctx.font = 'italic 21px Georgia, serif';
  ctx.fillText('An open-world crime story in the sun-soaked city of Solmar', W / 2, H * 0.28 + 132);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = 'rgba(255,233,196,0.9)';
  ctx.fillText('Rio Calder is back in town. Lena Cruz has work. The Solmar PD has other ideas.', W / 2, H * 0.28 + 162);
  const lines = [
    'WASD / Arrows — move and drive      E — steal / exit car',
    'Mouse — aim      Space / Click — shoot      P — pause      M — mute',
  ];
  ctx.font = '15px sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, W / 2, H * 0.28 + 196 + i * 24));
  if (G.saveData) {
    ctx.fillStyle = '#7be382';
    ctx.font = 'bold 15px sans-serif';
    const fares = G.saveData.faresDone ? ' • ' + G.saveData.faresDone + ' fare(s) run' : '';
    ctx.fillText(
      'Save found: $' + G.saveData.money + ' • ' + G.saveData.missionsDone.length + ' mission(s) done' + fares + ' — press C to continue',
      W / 2,
      H * 0.28 + 252,
    );
  }
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 19px sans-serif';
  const blink = Math.sin(G.time * 4) > -0.2;
  if (blink) ctx.fillText('PRESS ENTER OR CLICK TO PLAY', W / 2, H * 0.28 + 288);
  ctx.fillStyle = 'rgba(255,233,196,0.6)';
  ctx.font = '12px sans-serif';
  ctx.fillText('An original game: its city, characters, vehicles and story are all its own.', W / 2, H - 18);
}

function drawPause(G, ctx) {
  const W = CONFIG.VIEW_W;
  const H = CONFIG.VIEW_H;
  ctx.fillStyle = 'rgba(10, 14, 28, 0.6)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9c4';
  ctx.font = 'bold 54px "Arial Black", sans-serif';
  ctx.fillText('PAUSED', W / 2, H / 2 - 20);
  ctx.font = '16px sans-serif';
  ctx.fillText('P or Esc to keep playing  •  M to mute  •  progress saves automatically', W / 2, H / 2 + 18);
}

function drawEndScreen(G, ctx, title, sub) {
  const W = CONFIG.VIEW_W;
  const H = CONFIG.VIEW_H;
  ctx.fillStyle = 'rgba(10, 14, 28, 0.62)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = title === 'BUSTED' ? '#7fb8ff' : '#ff6a5a';
  ctx.font = 'bold 72px "Arial Black", sans-serif';
  ctx.fillText(title, W / 2, H / 2 - 30);
  ctx.fillStyle = '#ffe9c4';
  ctx.font = '17px sans-serif';
  ctx.fillText(sub, W / 2, H / 2 + 8);
  ctx.font = '15px sans-serif';
  ctx.fillText('Money kept: $' + G.player.money + '  •  Missions done: ' + G.missionsDone.length, W / 2, H / 2 + 40);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('PRESS ENTER TO TRY AGAIN', W / 2, H / 2 + 78);
}

function drawMissionComplete(G, ctx) {
  const W = CONFIG.VIEW_W;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(12, 18, 32, 0.78)';
  ctx.fillRect(W / 2 - 320, 200, 640, 110);
  ctx.strokeStyle = '#ffd23e';
  ctx.lineWidth = 2;
  ctx.strokeRect(W / 2 - 320, 200, 640, 110);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 34px "Arial Black", sans-serif';
  ctx.fillText(G.missionComplete.text, W / 2, 248);
  ctx.fillStyle = '#7be382';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('+$' + G.missionComplete.reward, W / 2, 284);
  ctx.restore();
}

function updateStatusLine(G) {
  const el = document.getElementById('status');
  if (!el) return;
  const objective = currentObjective(G);
  const text =
    'Solmar Heat. Health ' + Math.round(G.player.health) + ', money $' + G.player.money + ', wanted ' + G.wanted + ' stars. ' + objective;
  if (el.textContent !== text) el.textContent = text;
}
