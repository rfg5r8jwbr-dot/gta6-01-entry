// Solmar Heat — city generation for Solmar, a fictional sun-soaked coastal city.
// Builds the road grid, the blocks between the roads, the buildings inside
// them, the beach and sea on the south edge, a park, a plaza, and the fixed
// spots the missions use. Also owns building collision helpers.

import { CONFIG } from './config.js';
import { rngChance, rngInt, rngPick, rngRange } from './random.js';

// Build the whole city from a seed. Returns a plain data object; nothing here
// draws anything, render.js does that.
export function generateCity(rng) {
  const spacing = CONFIG.ROAD_SPACING;
  const first = CONFIG.FIRST_ROAD;
  const avenues = [];
  const streets = [];
  for (let x = first; x <= CONFIG.WORLD_W - first; x += spacing) avenues.push(x);
  for (let y = first; y <= CONFIG.WORLD_H - first; y += spacing) streets.push(y);

  const blocks = [];
  const buildings = [];
  const trees = [];
  const half = CONFIG.ROAD_W / 2 + CONFIG.SIDEWALK;

  // One block between each pair of neighbouring roads.
  for (let i = 0; i < avenues.length - 1; i++) {
    for (let j = 0; j < streets.length - 1; j++) {
      const x0 = avenues[i] + half;
      const x1 = avenues[i + 1] - half;
      const y0 = streets[j] + half;
      const y1 = streets[j + 1] - half;
      const isBeachRow = y0 >= CONFIG.BEACH_Y;
      // v2 districts: the west end is low Old Town, the middle is Downtown
      // towers, the east is Marina by the sea. The road grid is unchanged —
      // only the dressing differs, so every mission spot still works.
      const district = i <= 1 ? 'oldtown' : i <= 4 ? 'downtown' : 'marina';
      const block = { x0, y0, x1, y1, kind: 'city', isBeachRow, district };
      if (isBeachRow) {
        block.kind = 'sand';
      } else if (i === 3 && j === 2) {
        block.kind = 'park';
      } else if (i === 4 && j === 4) {
        block.kind = 'plaza';
      }
      blocks.push(block);

      if (block.kind === 'park') {
        for (let t = 0; t < 14; t++) {
          trees.push({
            x: rngRange(rng, x0 + 20, x1 - 20),
            y: rngRange(rng, y0 + 20, y1 - 20),
            r: rngRange(rng, 10, 17),
          });
        }
        continue;
      }
      if (block.kind === 'plaza' || block.kind === 'sand') continue;

      // 1 to 4 buildings per block, with a gap between them.
      const count = rngInt(rng, 1, 4);
      if (count === 1) {
        addBuilding(rng, buildings, x0 + 18, y0 + 18, x1 - x0 - 36, y1 - y0 - 36, district);
      } else if (count === 2) {
        const vertical = rngChance(rng, 0.5);
        if (vertical) {
          const cut = rngRange(rng, 0.4, 0.6);
          const w = (x1 - x0) * cut;
          addBuilding(rng, buildings, x0 + 12, y0 + 14, w - 24, y1 - y0 - 28, district);
          addBuilding(rng, buildings, x0 + w + 12, y0 + 14, x1 - x0 - w - 24, y1 - y0 - 28, district);
        } else {
          const cut = rngRange(rng, 0.4, 0.6);
          const h = (y1 - y0) * cut;
          addBuilding(rng, buildings, x0 + 14, y0 + 12, x1 - x0 - 28, h - 24, district);
          addBuilding(rng, buildings, x0 + 14, y0 + h + 12, x1 - x0 - 28, y1 - y0 - h - 24, district);
        }
      } else {
        const mx = (x0 + x1) / 2;
        const my = (y0 + y1) / 2;
        addBuilding(rng, buildings, x0 + 12, y0 + 12, mx - x0 - 24, my - y0 - 24, district);
        addBuilding(rng, buildings, mx + 12, y0 + 12, x1 - mx - 24, my - y0 - 24, district);
        addBuilding(rng, buildings, x0 + 12, my + 12, mx - x0 - 24, y1 - my - 24, district);
        addBuilding(rng, buildings, mx + 12, my + 12, x1 - mx - 24, y1 - my - 24, district);
      }
    }
  }

  // The Solmar Tower: the tallest building in Downtown, with a helipad —
  // the one landmark the skyline is read by.
  let tower = null;
  for (const b of buildings) {
    if (b.district === 'downtown' && (!tower || b.height > tower.height)) tower = b;
  }
  if (tower) {
    tower.height = 5;
    tower.detail = 'helipad';
    tower.roof = '#4a7fb5';
  }

  // Palms along the beach edge, so the sand reads as a resort strip.
  for (let i = 0; i < 10; i++) {
    trees.push({
      x: 260 + i * 300 + rngRange(rng, -40, 40),
      y: CONFIG.BEACH_Y + 34 + rngRange(rng, -8, 8),
      r: rngRange(rng, 9, 13),
    });
  }

  // Fixed mission spots, chosen on open ground (never inside a building).
  const plaza = blocks.find((b) => b.kind === 'plaza');
  const park = blocks.find((b) => b.kind === 'park');
  const spots = {
    start: { x: avenues[3], y: streets[3], label: 'Solmar' },
    lena: { x: (plaza.x0 + plaza.x1) / 2, y: (plaza.y0 + plaza.y1) / 2, label: "Lena's spot" },
    package: { x: avenues[6], y: streets[1], label: 'Package' },
    delivery: { x: avenues[1], y: streets[5], label: 'Drop-off' },
    beach: { x: avenues[4], y: CONFIG.BEACH_Y + 90, label: 'Beachfront' },
    hideout: { x: avenues[6], y: streets[6], label: 'Hideout' },
    park: { x: (park.x0 + park.x1) / 2, y: (park.y0 + park.y1) / 2, label: 'Palm Park' },
  };

  // Car spawn points: on roads, spread across the grid.
  const carSpawns = [];
  for (let n = 0; n < 40; n++) {
    if (rngChance(rng, 0.5)) {
      carSpawns.push({ x: rngPick(rng, avenues), y: rngRange(rng, 240, CONFIG.WORLD_H - 240) });
    } else {
      carSpawns.push({ x: rngRange(rng, 240, CONFIG.WORLD_W - 240), y: rngPick(rng, streets) });
    }
  }

  return {
    avenues,
    streets,
    blocks,
    buildings,
    trees,
    spots,
    carSpawns,
    roadW: CONFIG.ROAD_W,
    beachY: CONFIG.BEACH_Y,
    seaY: CONFIG.SEA_Y,
  };
}

function addBuilding(rng, buildings, x, y, w, h, district) {
  if (w < 40 || h < 40) return;
  // Height and roof colour follow the district: low warm Old Town, tall
  // Downtown, pale Marina. Rooftop detail (pool, AC units, helipad) is
  // drawn by render.js from the detail tag.
  const heights =
    district === 'downtown' ? [2, 3, 4] : district === 'oldtown' ? [1, 2] : [1, 2, 3];
  const roofs =
    district === 'downtown'
      ? ['#5b8a8a', '#4f7d6b', '#8a6f8e', '#a34d5e', '#3f6d8e']
      : district === 'oldtown'
        ? ['#c96f4a', '#b5533c', '#d9a05b', '#e0c184']
        : ['#e0c184', '#d9a05b', '#5b8a8a', '#c96f4a'];
  const roll = rng();
  const detail = roll < 0.14 ? 'pool' : roll < 0.34 ? 'ac' : 'none';
  buildings.push({
    x,
    y,
    w,
    h,
    height: rngPick(rng, heights),
    roof: rngPick(rng, roofs),
    wall: rngPick(rng, CONFIG.PALETTE.buildingWall),
    lit: rngChance(rng, 0.45),
    district,
    detail,
  });
}

// True when the point (with a small radius) is inside any building.
export function pointInBuilding(city, x, y, pad) {
  for (const b of city.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}

// Push a circle (x, y, radius) out of any building it overlaps. Mutates pos.
export function resolveBuildingCollision(city, pos, radius) {
  for (const b of city.buildings) {
    const nearestX = Math.max(b.x, Math.min(pos.x, b.x + b.w));
    const nearestY = Math.max(b.y, Math.min(pos.y, b.y + b.h));
    const dx = pos.x - nearestX;
    const dy = pos.y - nearestY;
    const distSq = dx * dx + dy * dy;
    if (distSq < radius * radius) {
      if (distSq === 0) {
        pos.y = b.y - radius;
        continue;
      }
      const dist = Math.sqrt(distSq);
      const push = (radius - dist) / dist;
      pos.x += dx * push;
      pos.y += dy * push;
    }
  }
}

// Nearest road centre line to a point: { kind: 'v' | 'h', coord }.
export function nearestRoad(city, x, y) {
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

// True when the point is on a road surface (drivable).
export function isOnRoad(city, x, y) {
  const half = CONFIG.ROAD_W / 2;
  for (const a of city.avenues) if (Math.abs(x - a) < half) return true;
  for (const s of city.streets) if (Math.abs(y - s) < half) return true;
  return false;
}
