// Marisol Bay: a sun-soaked coastal city generated from a seed. A grid of
// avenues crosses districts — downtown towers, a working port, suburbs, a
// park, pastel beachfront hotels — and ends at a sand beach and the sea. The
// static ground (roads, roofs, lawns, water) is painted once to an offscreen
// canvas; the simulation only ever draws the things that move.

import { BEACH_X, CITY, PALETTE, WATER_X, WORLD } from './config.js';

const GROUND_SCALE = 0.5;

export function roadCenter(index) {
  return index * CITY.pitch + CITY.road / 2;
}
export function blockOrigin(col, row) {
  return { x: col * CITY.pitch + CITY.road, y: row * CITY.pitch + CITY.road };
}
export function blockCenter(col, row) {
  const o = blockOrigin(col, row);
  return { x: o.x + CITY.block / 2, y: o.y + CITY.block / 2 };
}

export function districtOf(col, row) {
  if (col >= 10) return 'beach';
  if ((col === 5 || col === 6) && row === 5) return 'park';
  if (col >= 4 && col <= 6 && row >= 1 && row <= 3) return 'downtown';
  if (row >= 6 && col >= 1 && col <= 4) return 'port';
  if (col <= 2 && row >= 1 && row <= 4) return 'suburbs';
  if (col >= 8) return 'beachfront';
  return 'market';
}

const ROOF_SETS = {
  downtown: ['#8d99ae', '#6d7c8f', '#a8b2c1', '#7f8ea3', '#95a5b8'],
  market: ['#d9a066', '#c97b4a', '#b85c48', '#e0b184', '#a3a380'],
  beachfront: ['#ffd6e0', '#ffe5a8', '#b8ecf0', '#ffffff', '#ffc4a3'],
  port: ['#7a6a58', '#5f7263', '#86755f'],
  suburbs: ['#b8543f', '#a34d68', '#4f7d95', '#c97b4a', '#7768a8'],
};

function paintBuilding(ctx, b) {
  // Long afternoon shadow, then the roof with a parapet lip and details.
  ctx.fillStyle = 'rgba(40,30,20,0.28)';
  ctx.fillRect(b.x + b.hgt * 0.55, b.y + b.hgt * 0.7, b.w, b.h);
  ctx.fillStyle = b.color;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 3;
  ctx.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
  ctx.fillStyle = 'rgba(255,255,255,0.13)';
  if (b.kind === 'tower') {
    // Rooftop plant: AC boxes, a water tank, a helipad ring on the tallest.
    ctx.fillRect(b.x + b.w * 0.12, b.y + b.h * 0.12, b.w * 0.2, b.h * 0.16);
    ctx.fillRect(b.x + b.w * 0.62, b.y + b.h * 0.6, b.w * 0.24, b.h * 0.2);
    if (b.hgt > 95) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(b.x + b.w / 2, b.y + b.h / 2, Math.min(b.w, b.h) * 0.26, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (b.kind === 'house') {
    // Pitched roof: a ridge line with a lighter sunlit slope.
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.h);
    ctx.lineTo(b.x + b.w / 2, b.y);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x + b.w / 2, b.y);
    ctx.lineTo(b.x + b.w / 2, b.y + b.h);
    ctx.stroke();
  } else if (b.kind === 'warehouse') {
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 2;
    for (let x = b.x + 14; x < b.x + b.w - 6; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, b.y + 4);
      ctx.lineTo(x, b.y + b.h - 4);
      ctx.stroke();
    }
  }
}

function paintPalm(ctx, x, y, rand) {
  ctx.strokeStyle = 'rgba(90,70,40,0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 3, y - 4);
  ctx.stroke();
  ctx.strokeStyle = '#3e8e4f';
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + rand.range(-0.2, 0.2);
    ctx.beginPath();
    ctx.moveTo(x + 3, y - 4);
    ctx.quadraticCurveTo(
      x + 3 + Math.cos(a) * 13,
      y - 10 + Math.sin(a) * 6,
      x + 3 + Math.cos(a) * 20,
      y - 2 + Math.sin(a) * 11,
    );
    ctx.stroke();
  }
}

export function createCity(rand) {
  const buildings = [];
  const solids = [];
  const palms = [];
  const containers = [];

  function addBuilding(x, y, w, h, hgt, color, kind, name) {
    const b = { x, y, w, h, hgt, color, kind, name: name || '' };
    buildings.push(b);
    solids.push(b);
    return b;
  }

  for (let col = 0; col < CITY.cols; col += 1) {
    for (let row = 0; row < CITY.rows; row += 1) {
      const district = districtOf(col, row);
      const o = blockOrigin(col, row);
      const B = CITY.block;
      if (district === 'park' || district === 'beach') continue;
      if (col === 5 && row === 2) continue; // the bank's block, placed below
      if (district === 'downtown') {
        const w = rand.range(140, 175);
        const h = rand.range(140, 175);
        addBuilding(o.x + (B - w) / 2, o.y + (B - h) / 2, w, h, rand.range(60, 120), rand.pick(ROOF_SETS.downtown), 'tower');
      } else if (district === 'port') {
        addBuilding(o.x + 22, o.y + 60, 196, 116, 26, rand.pick(ROOF_SETS.port), 'warehouse');
        const n = rand.int(1, 3);
        for (let i = 0; i < n; i += 1) {
          const c = {
            x: o.x + rand.range(8, B - 52), y: o.y + rand.range(6, 44), w: 44, h: 18,
            color: rand.pick(['#c2543a', '#3a7ca5', '#4d9e6b', '#c9a227']),
          };
          containers.push(c);
          solids.push(c);
        }
      } else if (district === 'suburbs') {
        for (let hx = 0; hx < 2; hx += 1) {
          for (let hy = 0; hy < 2; hy += 1) {
            addBuilding(
              o.x + 18 + hx * 112, o.y + 20 + hy * 112, 78, 64, 14,
              rand.pick(ROOF_SETS.suburbs), 'house',
            );
          }
        }
      } else if (district === 'beachfront') {
        addBuilding(o.x + 26, o.y + 24, 84, 190, rand.range(28, 48), rand.pick(ROOF_SETS.beachfront), 'hotel');
        addBuilding(o.x + 134, o.y + 24, 84, 190, rand.range(22, 40), rand.pick(ROOF_SETS.beachfront), 'hotel');
      } else {
        // Market blocks: two shops with a shared forecourt.
        addBuilding(o.x + 16, o.y + 30, 96, 150, rand.range(20, 38), rand.pick(ROOF_SETS.market), 'shop');
        addBuilding(o.x + 128, o.y + 30, 96, 150, rand.range(20, 38), rand.pick(ROOF_SETS.market), 'shop');
      }
    }
  }

  // The named buildings the story runs through.
  const bankBlock = blockOrigin(5, 2);
  const bank = addBuilding(bankBlock.x + 30, bankBlock.y + 20, 180, 130, 130, '#54687f', 'tower', 'Marisol Trust');

  // Palms: along the beach, around the park, and dotted on downtown sidewalks.
  for (let y = 90; y < WORLD.height - 60; y += rand.range(120, 210)) {
    palms.push({ x: BEACH_X + rand.range(14, 60), y });
  }
  const parkA = blockOrigin(5, 5);
  for (let i = 0; i < 16; i += 1) {
    palms.push({ x: parkA.x + rand.range(20, 460), y: parkA.y + rand.range(16, CITY.block - 10) });
  }
  for (let i = 0; i < 26; i += 1) {
    const col = rand.int(3, 7);
    const row = rand.int(0, 7);
    const o = blockOrigin(col, row);
    palms.push({ x: o.x + rand.range(-8, CITY.block), y: o.y - 6 });
  }
  for (const p of palms) solids.push({ x: p.x - 4, y: p.y - 4, w: 8, h: 8, palm: true });

  // Named places, in world coordinates. Mission spots sit at door points on a
  // block edge beside a road, so a car on the road is inside their radius.
  const doorW = (col, row) => ({ x: blockOrigin(col, row).x - 24, y: blockCenter(col, row).y });
  const doorE = (col, row) => ({ x: blockOrigin(col, row).x + CITY.block + 24, y: blockCenter(col, row).y });
  const doorS = (col, row) => ({ x: blockCenter(col, row).x, y: blockOrigin(col, row).y + CITY.block + 24 });
  const spots = {
    garage: { ...doorW(2, 4), label: "Voss Auto — Delia's garage" },
    hideout: { ...doorE(8, 6), label: 'Beachfront lockup' },
    bankDoor: { x: bank.x + bank.w / 2, y: bank.y + bank.h + 26, label: 'Marisol Trust' },
    port: { ...doorS(2, 6), label: 'Port Marisol, Warehouse 9' },
    towerDrop: { ...doorW(6, 1), label: 'Azure Tower, downtown' },
    hospital: { ...doorW(7, 4), label: 'Marisol General' },
    station: { ...doorW(4, 4), label: 'MBPD Central' },
    beachDrops: [
      { x: BEACH_X + 130, y: 520 },
      { x: BEACH_X + 110, y: 1520 },
      { x: BEACH_X + 150, y: 2440 },
    ],
    cometSpot: { x: roadCenter(3) + 38, y: blockCenter(3, 3).y, label: 'A parked Comet Coupe' },
    gtSpot: { x: roadCenter(5) + 38, y: blockCenter(5, 1).y, label: 'A Solano GT, keys in' },
  };

  const ground = paintGround(rand, buildings, palms, containers);

  return {
    buildings,
    solids,
    palms,
    containers,
    spots,
    ground,
    groundScale: GROUND_SCALE,
    vRoads: Array.from({ length: 10 }, (_, i) => roadCenter(i)),
    hRoads: Array.from({ length: CITY.rows + 1 }, (_, j) => roadCenter(j)),
  };
}

function paintGround(rand, buildings, palms, containers) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(WORLD.width * GROUND_SCALE);
  canvas.height = Math.ceil(WORLD.height * GROUND_SCALE);
  const ctx = canvas.getContext('2d');
  ctx.scale(GROUND_SCALE, GROUND_SCALE);

  // Sea, then sand, then the city's base slab.
  const sea = ctx.createLinearGradient(WATER_X, 0, WORLD.width, 0);
  sea.addColorStop(0, PALETTE.water);
  sea.addColorStop(1, PALETTE.waterDeep);
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(BEACH_X, 0, WATER_X - BEACH_X + 30, WORLD.height);
  ctx.fillStyle = PALETTE.sidewalk;
  ctx.fillRect(0, 0, BEACH_X, WORLD.height);

  // District ground inside each block.
  for (let col = 0; col < CITY.cols; col += 1) {
    for (let row = 0; row < CITY.rows; row += 1) {
      const district = districtOf(col, row);
      const o = blockOrigin(col, row);
      if (district === 'suburbs') ctx.fillStyle = PALETTE.grass;
      else if (district === 'park') ctx.fillStyle = PALETTE.parkGrass;
      else if (district === 'beach') continue;
      else if (district === 'port') ctx.fillStyle = '#9a8f7d';
      else ctx.fillStyle = '#bfb49e';
      ctx.fillRect(o.x, o.y, CITY.block, CITY.block);
      if (district === 'park') {
        ctx.fillStyle = '#7fc4d8';
        ctx.beginPath();
        ctx.ellipse(o.x + 70, o.y + 70, 52, 36, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#e8dcc0';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(o.x, o.y + CITY.block - 30);
        ctx.lineTo(o.x + CITY.block, o.y + 40);
        ctx.stroke();
      }
    }
  }

  // Roads: asphalt strips with edge lines, dashes and crosswalks.
  ctx.fillStyle = PALETTE.road;
  for (let i = 0; i <= 10; i += 1) {
    const x = i * CITY.pitch;
    if (x < BEACH_X - 40) ctx.fillRect(x, 0, CITY.road, WORLD.height);
  }
  for (let j = 0; j <= CITY.rows; j += 1) {
    ctx.fillRect(0, j * CITY.pitch, BEACH_X + 60, CITY.road);
  }
  ctx.strokeStyle = PALETTE.roadEdge;
  ctx.lineWidth = 3;
  ctx.setLineDash([]);
  for (let i = 0; i <= 10; i += 1) {
    const cx = roadCenter(i);
    if (cx > BEACH_X) continue;
    for (const dx of [-CITY.road / 2 + 4, CITY.road / 2 - 4]) {
      ctx.beginPath();
      ctx.moveTo(cx + dx, 0);
      ctx.lineTo(cx + dx, WORLD.height);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = PALETTE.lane;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  for (let i = 0; i <= 10; i += 1) {
    const cx = roadCenter(i);
    if (cx > BEACH_X) continue;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, WORLD.height);
    ctx.stroke();
  }
  for (let j = 0; j <= CITY.rows; j += 1) {
    const cy = roadCenter(j);
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(BEACH_X + 40, cy);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Crosswalks at every intersection.
  ctx.fillStyle = 'rgba(245,233,200,0.75)';
  for (let i = 0; i <= 10; i += 1) {
    for (let j = 0; j <= CITY.rows; j += 1) {
      const cx = roadCenter(i);
      const cy = roadCenter(j);
      if (cx > BEACH_X) continue;
      for (let s = -3; s <= 3; s += 1) {
        ctx.fillRect(cx - 52, cy + s * 15 - 4, 26, 8);
        ctx.fillRect(cx + 26, cy + s * 15 - 4, 26, 8);
        ctx.fillRect(cx + s * 15 - 4, cy - 52, 8, 26);
        ctx.fillRect(cx + s * 15 - 4, cy + 26, 8, 26);
      }
    }
  }

  // Boardwalk along the sand, beach umbrellas, and two boats offshore.
  ctx.fillStyle = '#c9a06a';
  ctx.fillRect(BEACH_X - 26, 0, 26, WORLD.height);
  for (let i = 0; i < 22; i += 1) {
    const x = BEACH_X + rand.range(50, 190);
    const y = rand.range(40, WORLD.height - 40);
    ctx.fillStyle = rand.pick(['#ff5d7e', '#2ec4b6', '#ffc53d', '#f4f4f4']);
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const bx of [WATER_X + 90, WATER_X + 170]) {
    const by = bx === WATER_X + 90 ? 700 : 2100;
    ctx.fillStyle = '#f4f1ea';
    ctx.beginPath();
    ctx.ellipse(bx, by, 44, 13, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c2543a';
    ctx.fillRect(bx - 4, by - 22, 7, 22);
  }

  for (const b of buildings) paintBuilding(ctx, b);
  ctx.lineWidth = 2;
  for (const c of containers) {
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
  }
  for (const p of palms) paintPalm(ctx, p.x, p.y, rand);

  return canvas;
}
