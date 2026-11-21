// Boot and the one loop for Marisol Nights: input is read every frame, the
// world advances in fixed 1/60 s steps, missions are checked against the
// world, sound follows the action, and the renderer paints the screen —
// title, play, pause, help, busted, wasted or story-complete.
//
// ?seed=N fixes the city. ?shot=play|chase|city|end|start (with &seed=N)
// stages that screenshot scene instead of running the loop, paints it twice
// and sets window.__shotReady.

import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import { createWorld, EVENT_BUSTED, EVENT_WASTED } from './world.js';
import { createMissionController } from './missions.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_PAUSE, createInput } from './input.js';
import {
  createRenderer, SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_HELP, SCREEN_PAUSED,
  SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED,
} from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261122;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const rand = createRandom(seed);
const city = createCity(rand);
const world = createWorld(city, rand);
const audio = createAudio();
const renderer = createRenderer(canvas);

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeSave(ctrl) {
  try {
    const next = ctrl.storyDone ? 'done'
      : (ctrl.phase === 'outro-dialogue' || ctrl.phase === 'between') ? ctrl.storyIndex + 1
        : ctrl.storyIndex;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: world.player.cash,
      hasGun: world.player.hasGun,
      storyIndex: next,
      storyDone: ctrl.storyDone,
      x: world.player.x,
      y: world.player.y,
    }));
  } catch {
    // Storage can be off (private windows): the game then lasts this visit only.
  }
}

if (shot) {
  const ctrl = createMissionController(city.spots, rand);
  const scene = stageShot(shot, world, ctrl);
  const view = {
    world, time: 4, screen: scene.screen, snapCamera: true,
    objective: scene.objective || null, dialogue: null, banner: null,
    menu: scene.menu, menuIndex: scene.menuIndex || 0, endLines: scene.endLines,
    camAt: scene.camAt,
  };
  let painted = 0;
  const paint = () => {
    renderer.draw(view);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  };
  requestAnimationFrame(paint);
} else {
  runGame();
}

function runGame() {
  const input = createInput(canvas);
  let ctrl = createMissionController(city.spots, rand);
  let screen = SCREEN_TITLE;
  let menuIndex = 0;
  let banner = null;
  let bannerT = 0;
  let endLines = [];
  let pendingComplete = false;
  let lastStep = null;
  let accumulator = 0;
  let last = performance.now();
  let saveTimer = 0;

  world.reset(null);
  world.attract = true;

  function announce(message) {
    status.textContent = message;
  }
  function menuItems() {
    const items = ['New Game'];
    if (readSave()) items.push('Continue');
    items.push('How to Play');
    return items;
  }
  function showBanner(title, sub, color) {
    banner = { title, sub, color, t: 0 };
    bannerT = 3.2;
  }

  function startNew() {
    try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
    ctrl = createMissionController(city.spots, rand);
    world.reset(null);
    world.attract = false;
    ctrl.begin(0);
    screen = SCREEN_PLAY;
    audio.phone();
    announce('New game. Delia is calling.');
  }
  function startContinue() {
    const save = readSave();
    ctrl = createMissionController(city.spots, rand);
    world.reset(save);
    world.attract = false;
    if (save && save.storyDone) {
      ctrl.storyDone = true;
      ctrl.phase = 'between';
      ctrl.betweenTimer = 1.5;
    } else {
      ctrl.begin(save && save.storyIndex ? save.storyIndex : 0);
    }
    screen = SCREEN_PLAY;
    announce('Welcome back to Marisol Bay.');
  }

  function handleEvents() {
    for (const e of world.events) {
      if (e === 'shot') audio.shot();
      else if (e === 'punch') audio.punch();
      else if (e === 'cash' || e === 'pickup') audio.cash();
      else if (e === 'door') audio.door();
      else if (e === 'crash') audio.crash(1);
    }
    world.events.length = 0;
  }

  function onMissionEvent(result, missionBefore) {
    if (result === 'mission-done' && missionBefore) {
      audio.missionPass();
      showBanner('MISSION PASSED', `${missionBefore.title} · +$${missionBefore.reward.toLocaleString('en-US')}`);
      if (ctrl.storyDone && missionBefore.id === 'marisol-job') pendingComplete = true;
      writeSave(ctrl);
    } else if (result === 'step-done' || result === 'pickup') {
      audio.blip();
    } else if (result === 'failed') {
      audio.missionFail();
      showBanner('MISSION FAILED', 'Delia wants a word…', '#ff3b30');
    } else if (result === 'phone') {
      audio.phone();
      const m = ctrl.current();
      if (m) showBanner('NEW JOB', m.title, '#2ec4b6');
    }
  }

  function stepGame(dt) {
    const actions = input.takeActions();
    const dialogueOpen = ctrl.dialogue.length > 0
      && (ctrl.phase === 'intro-dialogue' || ctrl.phase === 'outro-dialogue');

    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
      return;
    }
    if (dialogueOpen && (actions & ACTION_CONFIRM)) {
      audio.unlock();
      ctrl.advanceDialogue();
      if (ctrl.phase === 'between' && pendingComplete) {
        pendingComplete = false;
        screen = SCREEN_COMPLETE;
        endLines = [
          'The Marisol Job is done — Marisol Bay belongs to Jules Marlowe.',
          `Cash $${world.player.cash.toLocaleString('en-US')} · All five of Delia's jobs complete`,
          'The phone stays on: courier work, cash and the open city, forever.',
        ];
        announce('Story complete.');
      }
      return;
    }

    // Enter / exit cars.
    if (actions & ACTION_ENTER) {
      audio.unlock();
      if (world.player.car) {
        world.exitCar();
      } else {
        const car = world.nearestCar(world.player.x, world.player.y, 58);
        if (car) {
          const tag = world.enterCar(car);
          if (tag && ctrl.notifyEnterCar(car) === 'step-done') {
            const before = ctrl.current();
            onMissionEvent(ctrl.completeStep(world), before);
          }
        }
      }
    }

    const aim = world.player.car ? null : renderer.toWorld({}, input.mouse.x, input.mouse.y);
    const flags = world.step(dt, {
      move: input.direction(),
      drive: input.driving(),
      run: input.running(),
      attack: !dialogueOpen && input.attackWanted(),
      aim,
    });
    handleEvents();

    const before = ctrl.current();
    const result = ctrl.update(dt, world);
    if (result) onMissionEvent(result, before);

    // Reset the beach drops whenever a fresh collect step becomes active.
    const stepNow = ctrl.step();
    if (stepNow !== lastStep) {
      if (stepNow && stepNow.kind === 'collect') world.resetDrops();
      lastStep = stepNow;
    }

    if (flags & EVENT_BUSTED) {
      const fine = world.respawn('busted');
      audio.sting();
      screen = SCREEN_BUSTED;
      endLines = [
        'The MBPD got their collar. Your car is impounded and your pockets are lighter.',
        `Bail and fines: $${fine.toLocaleString('en-US')} · Cash left: $${world.player.cash.toLocaleString('en-US')}`,
        'Delia is not impressed. The city, however, forgets quickly.',
      ];
      writeSave(ctrl);
      announce('Busted.');
    } else if (flags & EVENT_WASTED) {
      const fee = world.respawn('wasted');
      audio.sting();
      screen = SCREEN_WASTED;
      endLines = [
        'You wake up at Marisol General with a headache and a bill.',
        `Treatment: $${fee.toLocaleString('en-US')} · Cash left: $${world.player.cash.toLocaleString('en-US')}`,
        'The city kept spinning without you. It always does.',
      ];
      writeSave(ctrl);
      announce('Wasted.');
    }

    // Follow-cam sounds.
    const p = world.player;
    audio.engine(p.car ? Math.abs(p.car.speed) / p.car.model.top : null);
    const near = world.nearestPolice;
    audio.siren(world.wanted > 0 && near !== undefined && near < 700 ? 1 - near / 700 : 0);

    saveTimer -= dt;
    if (saveTimer <= 0) {
      saveTimer = 12;
      writeSave(ctrl);
    }
  }

  function objectiveView() {
    const step = ctrl.step();
    if (!step || ctrl.phase !== 'active') return null;
    const anchor = world.playerPos;
    if (step.kind === 'steal') {
      const car = world.cars.find((c) => c.tag === step.carTag);
      if (!car) return { label: step.label };
      return {
        x: car.x, y: car.y, label: step.label,
        dist: Math.hypot(anchor.x - car.x, anchor.y - car.y),
      };
    }
    if (step.kind === 'collect') {
      let best = null;
      let bestD = Infinity;
      step.points.forEach((pt, i) => {
        if (world.isCollected(i)) return;
        const d = Math.hypot(anchor.x - pt.x, anchor.y - pt.y);
        if (d < bestD) { bestD = d; best = pt; }
      });
      const taken = step.points.filter((_, i) => world.isCollected(i)).length;
      if (!best) return { label: step.label };
      return {
        x: best.x, y: best.y, label: step.label, dist: bestD,
        sub: `${taken} of ${step.points.length} recovered`,
      };
    }
    if (step.kind === 'escape') {
      return {
        label: step.label,
        sub: world.wanted > 0 ? `${world.wanted} star${world.wanted > 1 ? 's' : ''} — break line of sight` : 'Clear!',
      };
    }
    if (step.kind === 'hold') {
      return {
        x: step.x, y: step.y, label: step.label,
        dist: Math.hypot(anchor.x - step.x, anchor.y - step.y),
        sub: ctrl.holdTime > 0 ? `Hold still… ${Math.ceil(step.seconds - ctrl.holdTime)}` : 'On foot, in the circle',
      };
    }
    return {
      x: step.x, y: step.y, label: step.label,
      dist: Math.hypot(anchor.x - step.x, anchor.y - step.y),
      timer: step.time ? ctrl.timer : null,
      timerMax: step.time || 1,
    };
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (bannerT > 0) {
      bannerT -= 1 / 60;
      if (banner) banner.t += 1 / 60;
      if (bannerT <= 0) banner = null;
    }

    if (screen === SCREEN_TITLE || screen === SCREEN_HELP) {
      while (accumulator >= STEP) {
        world.step(STEP, { move: { x: 0, y: 0 }, drive: { throttle: 0, steer: 0 }, run: false, attack: false, aim: null });
        accumulator -= STEP;
      }
      const actions = input.takeActions();
      const dir = input.direction();
      if (screen === SCREEN_TITLE) {
        const items = menuItems();
        if (dir.y < 0 && frame.lastDir !== -1) menuIndex = (menuIndex + items.length - 1) % items.length;
        if (dir.y > 0 && frame.lastDir !== 1) menuIndex = (menuIndex + 1) % items.length;
        frame.lastDir = dir.y;
        if (actions & ACTION_CONFIRM) {
          audio.unlock();
          const pick = items[menuIndex];
          if (pick === 'New Game') startNew();
          else if (pick === 'Continue') startContinue();
          else screen = SCREEN_HELP;
        }
      } else if (actions & ACTION_CONFIRM) {
        screen = SCREEN_TITLE;
      }
    } else if (screen === SCREEN_PAUSED) {
      const actions = input.takeActions();
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) screen = SCREEN_PLAY;
      accumulator = 0;
    } else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED || screen === SCREEN_COMPLETE) {
      const actions = input.takeActions();
      if (actions & ACTION_CONFIRM) screen = SCREEN_PLAY;
      accumulator = 0;
    } else {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        stepGame(STEP);
        accumulator -= STEP;
      }
      if (screen !== SCREEN_PLAY) accumulator = 0;
    }

    const dialogueOpen = ctrl.dialogue.length > 0
      && (ctrl.phase === 'intro-dialogue' || ctrl.phase === 'outro-dialogue');
    renderer.draw({
      world,
      time: now / 1000,
      screen,
      menu: menuItems(),
      menuIndex,
      objective: screen === SCREEN_PLAY ? objectiveView() : null,
      dialogue: screen === SCREEN_PLAY && dialogueOpen ? ctrl.dialogue[0] : null,
      banner: screen === SCREEN_PLAY ? banner : null,
      endLines,
      camAt: screen === SCREEN_TITLE ? { x: 2400 + Math.sin(now / 9000) * 500, y: 800 + Math.cos(now / 11000) * 300 } : undefined,
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) screen = SCREEN_PAUSED;
  });
  announce('Marisol Nights. Choose New Game to start.');
  requestAnimationFrame(frame);
}
