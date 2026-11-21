// The screenshot scenes behind ?shot=play|chase|city|end. Each one builds a
// fresh world from the seed and plays the real rules forward with a simple
// autopilot, so every screenshot is a real render of a real moment: a
// delivery run, a police chase, a walk on the beachfront, the story's end.

import { STEP, WORLD } from './config.js';
import { SCREEN_COMPLETE, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const IDLE = { move: { x: 0, y: 0 }, drive: { throttle: 0, steer: 0 }, run: false, attack: false, aim: null };

function driveToward(world, tx, ty) {
  const car = world.player.car;
  if (!car) return IDLE;
  const target = Math.atan2(ty - car.y, tx - car.x);
  let diff = target - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return {
    move: { x: 0, y: 0 },
    drive: { throttle: 1, steer: Math.max(-1, Math.min(1, diff * 2.2)) },
    run: false, attack: false, aim: null,
  };
}

function run(world, seconds, inputFn) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) world.step(STEP, inputFn(i * STEP));
}

export function stageShot(name, world, ctrl) {
  const spots = world.city.spots;
  world.reset(null);
  if (name === 'chase') {
    // In the GT, three stars, police already on the tail, fleeing east.
    const gt = world.cars.find((c) => c.tag === 'gt');
    world.enterCar(gt);
    gt.x = 1500;
    gt.y = world.city.hRoads[2];
    gt.angle = 0;
    world.player.x = gt.x;
    world.player.y = gt.y;
    world.setWanted(3, true);
    const route = { x: WORLD.width - 700, y: world.city.hRoads[2] };
    run(world, 7, () => driveToward(world, route.x, route.y));
    return {
      screen: SCREEN_PLAY,
      objective: { label: 'Lose the police', sub: 'Break line of sight until the stars cool' },
    };
  }
  if (name === 'city') {
    // On foot on the boardwalk, a beach drop glowing ahead, city behind.
    world.player.x = spots.beachDrops[1].x - 150;
    world.player.y = spots.beachDrops[1].y + 30;
    world.player.angle = 0.4;
    world.player.cash = 1150;
    world.attract = true;
    run(world, 4, () => IDLE);
    world.attract = false;
    return {
      screen: SCREEN_PLAY,
      objective: {
        x: spots.beachDrops[1].x, y: spots.beachDrops[1].y,
        label: 'Recover the beach drops', dist: 150,
      },
    };
  }
  if (name === 'end') {
    // The story is done: the completion screen over the downtown bank.
    world.player.cash = 3740;
    world.player.hasGun = true;
    world.attract = true;
    run(world, 3, () => IDLE);
    world.attract = false;
    return {
      screen: SCREEN_COMPLETE,
      camAt: { x: spots.bankDoor.x - 640, y: spots.bankDoor.y - 500 },
      endLines: [
        'The Marisol Job paid +$2,000 — every job in the book is done.',
        'Cash $3,740 · Five missions · One very annoyed police department',
        'Free roam: courier work keeps coming on the phone.',
      ],
    };
  }
  if (name === 'start') {
    // The title over a living beachfront at golden hour.
    world.attract = true;
    run(world, 5, () => IDLE);
    return {
      screen: SCREEN_TITLE,
      menu: ['New Game', 'How to Play'],
      menuIndex: 0,
      camAt: { x: WORLD.width - 1500, y: 820 },
    };
  }
  // 'play': the first delivery — driving the Comet to the lockup, HUD full.
  ctrl.begin(0);
  ctrl.dialogue = [];
  ctrl.phase = 'active';
  ctrl.stepIndex = 2;
  const comet = world.cars.find((c) => c.tag === 'comet');
  world.enterCar(comet);
  comet.x = 2350;
  comet.y = world.city.hRoads[5];
  comet.angle = 0;
  world.player.x = comet.x;
  world.player.y = comet.y;
  world.player.cash = 250;
  run(world, 6.5, () => driveToward(world, spots.hideout.x, spots.hideout.y));
  const step = ctrl.step();
  return {
    screen: SCREEN_PLAY,
    objective: {
      x: step.x, y: step.y, label: step.label,
      dist: Math.hypot(world.playerPos.x - step.x, world.playerPos.y - step.y),
    },
  };
}
