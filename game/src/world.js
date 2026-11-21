// The living city: player, traffic, pedestrians, police, and every rule that
// connects them — driving and crashing, stealing cars, fists and gunfire, the
// wanted level and the bust meter. Fixed-step simulation; rendering and sound
// live elsewhere and only read what is here.

import { CAR, CAR_MODELS, CITY, PALETTE, PLAYER, POLICE, WANTED, WATER_X, WORLD } from './config.js';
import { blockOrigin } from './city.js';

export const EVENT_BUSTED = 1;
export const EVENT_WASTED = 2;

const TAU = Math.PI * 2;

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function angleTo(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}
function wrapAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}
/** Push a circle at (x, y) out of every solid AABB; returns the corrected point. */
function collideSolids(city, x, y, r) {
  for (const s of city.solids) {
    const nx = Math.max(s.x, Math.min(x, s.x + s.w));
    const ny = Math.max(s.y, Math.min(y, s.y + s.h));
    const dx = x - nx;
    const dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        y = ny + (dy / d) * r;
      } else {
        y = s.y - r;
      }
    }
  }
  return { x, y };
}

export function createWorld(city, rand) {
  const world = {
    city,
    rand,
    time: 0,
    events: [],
    particles: [],
    tracers: [],
    pickups: [],
    cars: [],
    peds: [],
    police: [],
    wanted: 0,
    heatTimer: 0,
    coolTimer: 0,
    policeSpawnTimer: 0,
    attract: false,
    dropsTaken: new Set(),
    player: {
      x: city.spots.garage.x - 90,
      y: city.spots.garage.y + 130,
      angle: -Math.PI / 2,
      health: PLAYER.maxHealth,
      cash: 0,
      car: null,
      hasGun: false,
      bust: 0,
      attackCd: 0,
      dead: false,
    },

    // ---- the facade the mission controller reads ----
    get playerPos() {
      return this.player.car || this.player;
    },
    get inCar() {
      return !!this.player.car;
    },
    addCash(n) {
      this.player.cash += n;
      this.events.push('cash');
    },
    unlockGun() {
      this.player.hasGun = true;
    },
    raiseWanted(n) {
      this.setWanted(Math.max(this.wanted, n), true);
    },
    clearWanted() {
      this.setWanted(0, false);
    },
    isCollected(i) {
      return this.dropsTaken.has(i);
    },
    collect(i) {
      this.dropsTaken.add(i);
      this.events.push('pickup');
      this.burst(city.spots.beachDrops[i].x, city.spots.beachDrops[i].y, PALETTE.gold, 10);
    },
    resetDrops() {
      this.dropsTaken.clear();
    },

    setWanted(n, crime) {
      const next = Math.max(0, Math.min(WANTED.max, n));
      if (next !== this.wanted) {
        this.wanted = next;
        if (crime) this.events.push('crime');
      }
      if (crime) {
        this.heatTimer = 0;
        this.coolTimer = 0;
      }
    },
    /** A crime the world may or may not have seen: level if witnessed. */
    commitCrime(level, x, y) {
      let witnessed = level >= 3;
      if (!witnessed) {
        for (const p of this.peds) {
          if (!p.down && Math.hypot(p.x - x, p.y - y) < 300) { witnessed = true; break; }
        }
        if (!witnessed) {
          for (const c of this.police) {
            if (Math.hypot(c.x - x, c.y - y) < WANTED.sightRange) { witnessed = true; break; }
          }
        }
      }
      if (witnessed) this.setWanted(Math.max(this.wanted, level), true);
    },

    burst(x, y, color, n) {
      for (let i = 0; i < n; i += 1) {
        const a = rand.range(0, TAU);
        const s = rand.range(30, 130);
        this.particles.push({
          x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30,
          life: rand.range(0.3, 0.7), maxLife: 0.7, color, size: rand.range(2, 4.5),
        });
      }
    },

    nearestCar(x, y, maxDist) {
      let best = null;
      let bestD = maxDist;
      for (const list of [this.cars, this.police]) {
        for (const c of list) {
          if (c.wrecked) continue;
          const d = Math.hypot(c.x - x, c.y - y);
          if (d < bestD) { bestD = d; best = c; }
        }
      }
      return best;
    },

    enterCar(car) {
      const p = this.player;
      p.car = car;
      car.driver = 'player';
      this.events.push('door');
      if (car.tag === 'comet' || car.tag === 'gt') {
        // Story cars: taking one is the mission, and for the GT it is a crime.
        if (car.tag === 'gt') this.setWanted(Math.max(this.wanted, 2), true);
        return car.tag;
      }
      if (car.wasTraffic) {
        this.commitCrime(1, car.x, car.y);
        this.spawnPed(car.x + 24, car.y, true);
      }
      return null;
    },
    exitCar() {
      const p = this.player;
      const car = p.car;
      if (!car) return;
      car.driver = 'parked';
      car.speed = 0;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
      const fixed = collideSolids(city, p.x, p.y, PLAYER.radius);
      p.x = fixed.x;
      p.y = fixed.y;
      p.car = null;
      this.events.push('door');
    },

    spawnPed(x, y, fleeing) {
      const col = Math.max(0, Math.min(CITY.cols - 1, Math.floor(x / CITY.pitch)));
      const row = Math.max(0, Math.min(CITY.rows - 1, Math.floor(y / CITY.pitch)));
      this.peds.push({
        x, y, angle: rand.range(0, TAU), speed: 0,
        col, row, t: rand.range(0, 1), dir: rand.chance(0.5) ? 1 : -1,
        color: rand.pick(['#e4572e', '#17bebb', '#ffc914', '#76b041', '#e8e8e8', '#9558b2', '#3a86ff']),
        flee: fleeing ? 5 : 0, fleeFrom: { x, y }, down: 0, panic: 0,
      });
    },

    makeCar(x, y, angle, modelIdx, opts = {}) {
      const model = CAR_MODELS[modelIdx];
      return {
        x, y, angle, speed: 0,
        model, color: opts.color || rand.pick(model.colours),
        tag: opts.tag || '', police: !!opts.police,
        driver: opts.driver || 'parked',
        wasTraffic: opts.driver === 'traffic',
        health: 100, wrecked: false,
        axis: opts.axis || 'v', roadIdx: opts.roadIdx || 0, dirSign: opts.dirSign || 1,
        turnCooldown: 0, shootCd: rand.range(0.4, 1.2),
        lightPhase: rand.range(0, TAU),
      };
    },

    reset(save) {
      const p = this.player;
      this.cars = [];
      this.peds = [];
      this.police = [];
      this.pickups = [];
      this.particles = [];
      this.tracers = [];
      this.wanted = 0;
      this.heatTimer = 0;
      this.coolTimer = 0;
      this.dropsTaken.clear();
      p.health = PLAYER.maxHealth;
      p.car = null;
      p.dead = false;
      p.bust = 0;
      p.cash = save ? save.cash : 0;
      p.hasGun = save ? !!save.hasGun : false;
      p.x = save && save.x ? save.x : city.spots.garage.x - 90;
      p.y = save && save.y ? save.y : city.spots.garage.y + 130;

      // The two story cars, parked where the story needs them.
      this.cars.push(this.makeCar(city.spots.cometSpot.x, city.spots.cometSpot.y, Math.PI / 2, 0, { tag: 'comet', color: '#e8452c' }));
      this.cars.push(this.makeCar(city.spots.gtSpot.x, city.spots.gtSpot.y, Math.PI / 2, 4, { tag: 'gt', color: '#ffcf3f' }));
      // Parked cars along the avenues.
      for (let i = 0; i < 26; i += 1) {
        const vertical = rand.chance(0.5);
        const road = vertical ? rand.pick(city.vRoads) : rand.pick(city.hRoads);
        const along = rand.range(120, (vertical ? WORLD.height : WORLD.width) - 160);
        const side = rand.chance(0.5) ? 40 : -40;
        const x = vertical ? road + side : along;
        const y = vertical ? along : road + side;
        if (x > WATER_X - 60) continue;
        const fixed = collideSolids(city, x, y, 20);
        this.cars.push(this.makeCar(fixed.x, fixed.y, vertical ? Math.PI / 2 : 0, rand.int(0, CAR_MODELS.length - 1), {}));
      }
      // Traffic already rolling.
      for (let i = 0; i < 13; i += 1) this.spawnTraffic();
      // Pedestrians on their block loops.
      for (let i = 0; i < 42; i += 1) {
        this.spawnPed(rand.range(140, WORLD.width - 500), rand.range(140, WORLD.height - 140), false);
      }
    },

    spawnTraffic() {
      const vertical = rand.chance(0.5);
      const roads = vertical ? city.vRoads : city.hRoads;
      const roadIdx = rand.int(0, roads.length - 1);
      const dirSign = rand.chance(0.5) ? 1 : -1;
      const along = rand.range(80, (vertical ? WORLD.height : WORLD.width) - 120);
      const lane = roads[roadIdx] + (vertical ? (dirSign > 0 ? -26 : 26) : 0);
      const x = vertical ? lane : along;
      const y = vertical ? along : roads[roadIdx] + (dirSign > 0 ? 26 : -26);
      if (x > WATER_X - 40) return;
      const car = this.makeCar(x, y, 0, rand.int(0, CAR_MODELS.length - 1), {
        driver: 'traffic', axis: vertical ? 'v' : 'h', roadIdx, dirSign,
      });
      car.angle = vertical ? (dirSign > 0 ? Math.PI / 2 : -Math.PI / 2) : (dirSign > 0 ? 0 : Math.PI);
      car.speed = rand.range(60, 110);
      this.cars.push(car);
    },

    /** The step. input: {move:{x,y}, drive:{throttle,steer}, run, attack, aim:{x,y}|null, enter} */
    step(dt, input) {
      this.time += dt;
      const p = this.player;
      let flags = 0;
      p.attackCd = Math.max(0, p.attackCd - dt);

      if (p.car) this.stepPlayerCar(dt, input);
      else this.stepPlayerFoot(dt, input);

      this.stepTraffic(dt);
      this.stepPeds(dt);
      flags |= this.stepPolice(dt);
      this.stepWanted(dt);

      // Particles, tracers, pickups.
      for (let i = this.particles.length - 1; i >= 0; i -= 1) {
        const pt = this.particles[i];
        pt.life -= dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vy += 160 * dt;
        if (pt.life <= 0) this.particles.splice(i, 1);
      }
      for (let i = this.tracers.length - 1; i >= 0; i -= 1) {
        this.tracers[i].life -= dt;
        if (this.tracers[i].life <= 0) this.tracers.splice(i, 1);
      }
      const anchor = this.playerPos;
      for (let i = this.pickups.length - 1; i >= 0; i -= 1) {
        const pk = this.pickups[i];
        pk.ttl -= dt;
        if (pk.ttl <= 0) { this.pickups.splice(i, 1); continue; }
        if (Math.hypot(pk.x - anchor.x, pk.y - anchor.y) < 30) {
          p.cash += pk.amount;
          this.events.push('cash');
          this.burst(pk.x, pk.y, PALETTE.gold, 6);
          this.pickups.splice(i, 1);
        }
      }
      if (p.health <= 0 && !p.dead) {
        p.dead = true;
        flags |= EVENT_WASTED;
      }
      return flags;
    },

    stepPlayerFoot(dt, input) {
      const p = this.player;
      const { x: mx, y: my } = input.move;
      const mag = Math.hypot(mx, my);
      if (mag > 0.01) {
        const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
        const nx = p.x + (mx / mag) * speed * dt;
        const ny = p.y + (my / mag) * speed * dt;
        const fixed = collideSolids(city, nx, ny, PLAYER.radius);
        p.x = fixed.x;
        p.y = fixed.y;
        p.angle = Math.atan2(my, mx);
        p.moving = true;
      } else {
        p.moving = false;
      }
      if (input.aim) p.angle = Math.atan2(input.aim.y - p.y, input.aim.x - p.x);
      p.x = Math.max(20, Math.min(WORLD.width - 60, p.x));
      p.y = Math.max(20, Math.min(WORLD.height - 20, p.y));
      if (p.x > WATER_X + 26) p.x = WATER_X + 26;

      if (input.attack && p.attackCd <= 0) {
        p.attackCd = p.hasGun ? PLAYER.shotCooldown : PLAYER.punchCooldown;
        if (p.hasGun) this.fireGun(p.x, p.y, p.angle, true);
        else this.punch(p.x, p.y, p.angle, true);
      }
    },

    stepPlayerCar(dt, input) {
      const p = this.player;
      const car = p.car;
      const model = car.model;
      const { throttle, steer } = input.drive;
      const topSpeed = model.top;
      if (throttle > 0) car.speed += CAR.accel * model.accel * throttle * dt;
      else if (throttle < 0) {
        car.speed += (car.speed > 4 ? -CAR.brake : CAR.accel * 0.5 * throttle) * dt;
      }
      car.speed -= car.speed * CAR.drag * dt;
      car.speed = Math.max(-CAR.maxReverse, Math.min(topSpeed, car.speed));
      if (Math.abs(car.speed) > 2) {
        car.angle += steer * CAR.grip * (Math.abs(car.speed) / topSpeed) * dt * (car.speed < 0 ? -1 : 1);
      }
      const vx = Math.cos(car.angle) * car.speed;
      const vy = Math.sin(car.angle) * car.speed;
      let nx = car.x + vx * dt;
      let ny = car.y + vy * dt;
      const before = { x: car.x, y: car.y };
      const fixed = collideSolids(city, nx, ny, 21);
      nx = fixed.x;
      ny = fixed.y;
      const blocked = Math.hypot(nx - (car.x + vx * dt), ny - (car.y + vy * dt));
      if (blocked > 2 && Math.abs(car.speed) > 120) {
        this.events.push('crash');
        this.burst(car.x, car.y, '#ffd9a0', 8);
        car.health -= blocked * 0.35;
        p.health -= blocked * 0.05;
        car.speed *= -0.25;
      } else if (blocked > 2) {
        car.speed *= 0.4;
      }
      car.x = Math.max(24, Math.min(WORLD.width - 70, nx));
      car.y = Math.max(24, Math.min(WORLD.height - 24, ny));
      if (car.x > WATER_X + 10) { car.x = WATER_X + 10; car.speed = 0; }
      // Other cars are obstacles, and peds are not.
      for (const other of [...this.cars, ...this.police]) {
        if (other === car) continue;
        const d = Math.hypot(other.x - car.x, other.y - car.y);
        if (d < 40 && d > 0.01) {
          const push = (40 - d) / 2;
          const ux = (other.x - car.x) / d;
          const uy = (other.y - car.y) / d;
          other.x += ux * push;
          other.y += uy * push;
          if (Math.abs(car.speed) > 90) {
            other.health -= 12;
            this.events.push('crash');
            this.burst(other.x, other.y, '#ffb3a0', 6);
            if (other.police) this.setWanted(Math.max(this.wanted, 2), true);
          }
          car.speed *= 0.82;
        }
      }
      for (const ped of this.peds) {
        if (ped.down > 0) continue;
        const d = Math.hypot(ped.x - car.x, ped.y - car.y);
        if (d < 26 && Math.abs(car.speed) > 55) {
          ped.down = 5;
          ped.flee = 8;
          this.burst(ped.x, ped.y, '#e4572e', 8);
          this.commitCrime(2, ped.x, ped.y);
          if (rand.chance(0.6)) this.pickups.push({ x: ped.x, y: ped.y, amount: rand.int(10, 45), ttl: 25 });
          car.speed *= 0.9;
        }
      }
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      void before;
    },

    fireGun(x, y, angle, byPlayer) {
      this.events.push('shot');
      const range = 330;
      const ex = x + Math.cos(angle) * range;
      const ey = y + Math.sin(angle) * range;
      let hitX = ex;
      let hitY = ey;
      let bestT = 1;
      const testCircle = (cx, cy, r) => {
        const dx = cx - x;
        const dy = cy - y;
        const t = (dx * Math.cos(angle) + dy * Math.sin(angle)) / range;
        if (t < 0 || t > bestT) return -1;
        const px = x + Math.cos(angle) * range * t;
        const py = y + Math.sin(angle) * range * t;
        if (Math.hypot(cx - px, cy - py) < r) return t;
        return -1;
      };
      let hitPed = null;
      let hitCar = null;
      for (const ped of this.peds) {
        if (ped.down > 0) continue;
        const t = testCircle(ped.x, ped.y, 13);
        if (t >= 0) { bestT = t; hitPed = ped; hitCar = null; }
      }
      for (const car of [...this.cars, ...this.police]) {
        if (car === this.player.car) continue;
        const t = testCircle(car.x, car.y, 24);
        if (t >= 0) { bestT = t; hitCar = car; hitPed = null; }
      }
      hitX = x + Math.cos(angle) * range * bestT;
      hitY = y + Math.sin(angle) * range * bestT;
      this.tracers.push({ x1: x, y1: y, x2: hitX, y2: hitY, life: 0.09 });
      this.burst(hitX, hitY, '#ffe08a', 3);
      if (hitPed) {
        hitPed.down = 6;
        hitPed.flee = 9;
        hitPed.fleeFrom = { x, y };
        if (rand.chance(0.55)) this.pickups.push({ x: hitPed.x, y: hitPed.y, amount: rand.int(8, 40), ttl: 25 });
        if (byPlayer) this.commitCrime(2, hitPed.x, hitPed.y);
      }
      if (hitCar) {
        hitCar.health -= 16;
        if (hitCar.police && byPlayer) this.setWanted(Math.max(this.wanted, 3), true);
        if (hitCar.driver === 'traffic') {
          hitCar.driver = 'parked';
          this.spawnPed(hitCar.x + 20, hitCar.y + 10, true);
        }
      }
      // Gunfire panics everyone nearby.
      for (const ped of this.peds) {
        if (Math.hypot(ped.x - x, ped.y - y) < 280) {
          ped.flee = Math.max(ped.flee, 4);
          ped.fleeFrom = { x, y };
        }
      }
      if (byPlayer) this.commitCrime(1, x, y);
    },

    punch(x, y, angle, byPlayer) {
      this.events.push('punch');
      const tx = x + Math.cos(angle) * PLAYER.punchRange;
      const ty = y + Math.sin(angle) * PLAYER.punchRange;
      for (const ped of this.peds) {
        if (ped.down > 0) continue;
        if (Math.hypot(ped.x - tx, ped.y - ty) < 22) {
          ped.down = 4;
          ped.flee = 8;
          ped.fleeFrom = { x, y };
          this.burst(ped.x, ped.y, '#f2d492', 5);
          if (rand.chance(0.5)) this.pickups.push({ x: ped.x, y: ped.y, amount: rand.int(5, 30), ttl: 25 });
          if (byPlayer) this.commitCrime(1, ped.x, ped.y);
          return;
        }
      }
    },

    stepTraffic(dt) {
      const p = this.player;
      for (let i = this.cars.length - 1; i >= 0; i -= 1) {
        const car = this.cars[i];
        if (car.health <= 0 && !car.wrecked) {
          car.wrecked = true;
          car.driver = 'parked';
          this.burst(car.x, car.y, '#888', 12);
        }
        if (car.driver !== 'traffic') continue;
        // Waypoint: far ahead on the current lane; near an intersection, maybe turn.
        const roads = car.axis === 'v' ? city.vRoads : city.hRoads;
        const cross = car.axis === 'v' ? city.hRoads : city.vRoads;
        const laneCoord = roads[car.roadIdx] + (car.axis === 'v' ? (car.dirSign > 0 ? -26 : 26) : (car.dirSign > 0 ? 26 : -26));
        let tx = car.axis === 'v' ? laneCoord : car.x + car.dirSign * 300;
        let ty = car.axis === 'v' ? car.y + car.dirSign * 300 : laneCoord;
        // Stop for the player on foot ahead, or a slow car ahead.
        let wantSpeed = 118;
        const aheadX = car.x + Math.cos(car.angle) * 58;
        const aheadY = car.y + Math.sin(car.angle) * 58;
        if (!p.car && Math.hypot(p.x - aheadX, p.y - aheadY) < 34) wantSpeed = 0;
        for (const other of this.cars) {
          if (other === car) continue;
          if (Math.hypot(other.x - aheadX, other.y - aheadY) < 40) wantSpeed = Math.min(wantSpeed, 30);
        }
        for (const ped of this.peds) {
          if (ped.down <= 0 && Math.hypot(ped.x - aheadX, ped.y - aheadY) < 30) wantSpeed = 0;
        }
        car.speed += Math.sign(wantSpeed - car.speed) * Math.min(Math.abs(wantSpeed - car.speed), 190 * dt);
        // Intersection turn?
        car.turnCooldown -= dt;
        if (car.turnCooldown <= 0) {
          for (let ci = 0; ci < cross.length; ci += 1) {
            const c = cross[ci];
            const along = car.axis === 'v' ? car.y : car.x;
            if (Math.abs(along - c) < 14 && rand.chance(0.4)) {
              car.axis = car.axis === 'v' ? 'h' : 'v';
              car.roadIdx = ci;
              car.dirSign = rand.chance(0.5) ? 1 : -1;
              car.turnCooldown = 2.5;
              break;
            }
          }
        }
        const targetAngle = Math.atan2(ty - car.y, tx - car.x);
        car.angle += wrapAngle(targetAngle - car.angle) * Math.min(1, 3.2 * dt);
        car.x += Math.cos(car.angle) * car.speed * dt;
        car.y += Math.sin(car.angle) * car.speed * dt;
        const fixed = collideSolids(city, car.x, car.y, 20);
        car.x = fixed.x;
        car.y = fixed.y;
        if (car.x < 30 || car.x > WORLD.width - 90 || car.y < 30 || car.y > WORLD.height - 30) {
          this.cars.splice(i, 1);
          this.spawnTraffic();
        }
      }
    },

    stepPeds(dt) {
      const anchor = this.playerPos;
      for (const ped of this.peds) {
        if (ped.down > 0) {
          ped.down -= dt;
          continue;
        }
        // Flee danger: gunfire, a fast car, or the player swinging.
        let threat = null;
        if (ped.flee > 0) {
          ped.flee -= dt;
          threat = ped.fleeFrom;
        }
        const carThreat = this.player.car && Math.abs(this.player.car.speed) > 120
          && Math.hypot(ped.x - anchor.x, ped.y - anchor.y) < 110;
        if (carThreat) threat = anchor;
        if (threat) {
          const a = Math.atan2(ped.y - threat.y, ped.x - threat.x);
          ped.angle = a;
          ped.x += Math.cos(a) * 165 * dt;
          ped.y += Math.sin(a) * 165 * dt;
          const fixed = collideSolids(city, ped.x, ped.y, 11);
          ped.x = fixed.x;
          ped.y = fixed.y;
          continue;
        }
        // Otherwise stroll the sidewalk loop around their home block.
        const o = blockOrigin(ped.col, ped.row);
        const inset = 13;
        const w = CITY.block + inset * 2;
        const per = w * 4;
        ped.t = (ped.t + (ped.dir * 42 * dt) / per + 1) % 1;
        const s = ped.t * per;
        let lx;
        let ly;
        if (s < w) { lx = -inset + s; ly = -inset; }
        else if (s < w * 2) { lx = w - inset; ly = -inset + (s - w); }
        else if (s < w * 3) { lx = w - inset - (s - w * 2); ly = w - inset; }
        else { lx = -inset; ly = w - inset - (s - w * 3); }
        const nx = o.x + lx;
        const ny = o.y + ly;
        ped.angle = Math.atan2(ny - ped.y, nx - ped.x);
        ped.x = nx;
        ped.y = ny;
        void anchor;
      }
    },

    stepPolice(dt) {
      let flags = 0;
      const p = this.player;
      const anchor = this.playerPos;
      // Spawn to match the wanted level, arriving from off-screen roads.
      this.policeSpawnTimer -= dt;
      const desired = this.attract || this.wanted === 0 ? 0 : Math.min(this.wanted + 1, POLICE.maxCars);
      if (this.police.length < desired && this.policeSpawnTimer <= 0) {
        this.policeSpawnTimer = 2.2;
        const a = rand.range(0, TAU);
        const sx = anchor.x + Math.cos(a) * 640;
        const sy = anchor.y + Math.sin(a) * 640;
        const fixed = collideSolids(city, Math.max(40, Math.min(WORLD.width - 120, sx)), Math.max(40, Math.min(WORLD.height - 40, sy)), 22);
        const cop = this.makeCar(fixed.x, fixed.y, 0, 1, { police: true, driver: 'police', color: '#18222e' });
        cop.speed = 120;
        this.police.push(cop);
      }
      if (this.wanted === 0 && this.police.length > 0 && this.policeSpawnTimer <= -6) {
        this.police.pop();
        this.policeSpawnTimer = 0;
      }
      let nearest = Infinity;
      for (let i = this.police.length - 1; i >= 0; i -= 1) {
        const cop = this.police[i];
        if (cop.health <= 0) {
          this.burst(cop.x, cop.y, '#666', 14);
          this.police.splice(i, 1);
          continue;
        }
        const d = dist(cop, anchor);
        nearest = Math.min(nearest, d);
        const predict = {
          x: anchor.x + (p.car ? Math.cos(p.car.angle) * p.car.speed * 0.35 : 0),
          y: anchor.y + (p.car ? Math.sin(p.car.angle) * p.car.speed * 0.35 : 0),
        };
        const targetAngle = angleTo(cop, predict);
        cop.angle += wrapAngle(targetAngle - cop.angle) * Math.min(1, 2.6 * dt);
        const topSpeed = 218 + this.wanted * 22;
        const want = d > 46 ? topSpeed : 30;
        cop.speed += Math.sign(want - cop.speed) * Math.min(Math.abs(want - cop.speed), 300 * dt);
        cop.x += Math.cos(cop.angle) * cop.speed * dt;
        cop.y += Math.sin(cop.angle) * cop.speed * dt;
        const fixed = collideSolids(city, cop.x, cop.y, 21);
        cop.x = fixed.x;
        cop.y = fixed.y;
        // Ramming hurts.
        if (p.car && d < 42 && Math.abs(cop.speed) > 130) {
          p.car.health -= 9 * dt * 10;
          p.health -= 3.5;
          this.events.push('crash');
          cop.speed *= 0.55;
        }
        // Gunfire at high heat.
        if (this.wanted >= 4 && d < POLICE.shootRange) {
          cop.shootCd -= dt;
          if (cop.shootCd <= 0) {
            cop.shootCd = rand.range(0.7, 1.3);
            this.tracers.push({ x1: cop.x, y1: cop.y, x2: anchor.x, y2: anchor.y, life: 0.09 });
            this.events.push('shot');
            if (!p.car) p.health -= 5;
            else p.car.health -= 4;
          }
        }
      }
      // The bust meter: close police + a slow or on-foot player.
      const bustRange = p.car ? POLICE.bustRangeCar : POLICE.bustRangeFoot;
      const playerSlow = !p.car || Math.abs(p.car.speed) < 26;
      if (!this.attract && this.wanted > 0 && nearest < bustRange && playerSlow) {
        p.bust += dt / POLICE.bustFill;
      } else {
        p.bust = Math.max(0, p.bust - dt * POLICE.bustDecay * 0.4);
      }
      if (p.bust >= 1 && !p.dead) {
        p.dead = true;
        flags |= EVENT_BUSTED;
      }
      this.nearestPolice = nearest;
      return flags;
    },

    stepWanted(dt) {
      if (this.wanted === 0) return;
      this.heatTimer += dt;
      const seen = this.nearestPolice !== undefined && this.nearestPolice < WANTED.sightRange;
      if (this.heatTimer > WANTED.coolDelay && !seen) {
        this.coolTimer += dt;
        if (this.coolTimer >= WANTED.coolPerStar) {
          this.coolTimer = 0;
          this.heatTimer = 0;
          this.setWanted(this.wanted - 1, false);
        }
      } else {
        this.coolTimer = 0;
      }
    },

    respawn(kind) {
      const p = this.player;
      const spot = kind === 'busted' ? city.spots.station : city.spots.hospital;
      if (p.car) {
        p.car.driver = 'parked';
        p.car = null;
      }
      p.x = spot.x - 40;
      p.y = spot.y + 40;
      p.health = PLAYER.maxHealth;
      p.bust = 0;
      p.dead = false;
      this.setWanted(0, false);
      this.police = [];
      const fine = kind === 'busted' ? Math.max(50, Math.round(p.cash * 0.1)) : 150;
      p.cash = Math.max(0, p.cash - fine);
      return fine;
    },
  };
  return world;
}
