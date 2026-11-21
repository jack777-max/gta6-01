// Keyboard and mouse input: held keys as a direction plus a queue of one-shot
// actions (confirm, pause, enter car, attack, advance dialogue). Mouse position
// is tracked in view coordinates so the player can aim with it.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_ATTACK = 8;

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  Space: ACTION_CONFIRM,
  Escape: ACTION_PAUSE,
  KeyP: ACTION_PAUSE,
  KeyF: ACTION_ENTER,
  KeyE: ACTION_ENTER,
  KeyJ: ACTION_ATTACK,
};

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let attackQueued = false;
  const mouse = { x: 0, y: 0, down: false };

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    const action = KEY_ACTIONS[event.code];
    if (action) {
      actions |= action;
      if (action === ACTION_ATTACK) attackQueued = true;
      if (action === ACTION_CONFIRM || action === ACTION_ENTER) event.preventDefault();
    }
    if (event.code === 'Space') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    mouse.down = true;
    if (event.button === 0) {
      actions |= ACTION_CONFIRM;
      attackQueued = true;
    }
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });

  return {
    mouse,
    /** Held movement as x/y in [-1, 1] from WASD or the arrow keys. */
    direction() {
      let x = 0;
      let y = 0;
      if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1;
      if (held.has('KeyD') || held.has('ArrowRight')) x += 1;
      if (held.has('KeyW') || held.has('ArrowUp')) y -= 1;
      if (held.has('KeyS') || held.has('ArrowDown')) y += 1;
      return { x, y };
    },
    /** Driving pedals: throttle in [-1, 1] and steering in [-1, 1]. */
    driving() {
      let throttle = 0;
      let steer = 0;
      if (held.has('KeyW') || held.has('ArrowUp')) throttle += 1;
      if (held.has('KeyS') || held.has('ArrowDown')) throttle -= 1;
      if (held.has('KeyA') || held.has('ArrowLeft')) steer -= 1;
      if (held.has('KeyD') || held.has('ArrowRight')) steer += 1;
      return { throttle, steer };
    },
    running() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Attack is level-triggered while the mouse is held, one-shot from keys. */
    attackWanted() {
      const wanted = attackQueued || mouse.down;
      attackQueued = false;
      return wanted;
    },
  };
}
