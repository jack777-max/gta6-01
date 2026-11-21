// The story of Marisol Nights, as data plus a small controller. Jules Marlowe,
// new in Marisol Bay, runs jobs for fixer Delia Voss: five story missions that
// teach the city (steal, deliver, collect, escape, rob), then endless courier
// work. Steps are plain data — go somewhere, take a tagged car, gather drops,
// hold a spot, lose the heat — and the controller checks them against the
// game facade it is handed each step, so it never imports the world itself.

export function storyMissions(spots) {
  return [
    {
      id: 'first-wheels',
      title: 'First Wheels',
      reward: 250,
      intro: [
        { who: 'Delia Voss', text: 'Jules. Heard you can drive. My garage is in the suburbs — Voss Auto. Get here.' },
        { who: 'Jules', text: 'On my way. What is the job?' },
        { who: 'Delia Voss', text: 'A Comet Coupe, parked up by the market. Take it, bring it to the beachfront lockup. Quietly.' },
      ],
      outro: [
        { who: 'Delia Voss', text: 'Clean work. The city pays people who show up, Jules. Stick with me.' },
      ],
      steps: [
        { kind: 'goto', x: spots.garage.x, y: spots.garage.y, r: 60, need: 'any', label: 'Go to Voss Auto' },
        { kind: 'steal', carTag: 'comet', label: 'Take the Comet Coupe' },
        { kind: 'goto', x: spots.hideout.x, y: spots.hideout.y, r: 64, need: 'car', label: 'Deliver the Comet to the lockup' },
      ],
    },
    {
      id: 'quiet-package',
      title: 'Quiet Package',
      reward: 400,
      unlockGun: true,
      intro: [
        { who: 'Delia Voss', text: 'Warehouse 9 at the port. A package comes off a boat tonight — it leaves with you.' },
        { who: 'Delia Voss', text: 'Drop it at Azure Tower, downtown. And Jules — I left you a little insurance in the glovebox. A pistol. Use it only if you must.' },
      ],
      outro: [
        { who: 'Delia Voss', text: 'Package delivered, nobody the wiser. You are getting good at this.' },
      ],
      steps: [
        { kind: 'goto', x: spots.port.x, y: spots.port.y, r: 62, need: 'any', label: 'Pick up the package at Warehouse 9', setWanted: 1 },
        { kind: 'goto', x: spots.towerDrop.x, y: spots.towerDrop.y, r: 64, need: 'car', label: 'Deliver to Azure Tower', time: 150 },
      ],
    },
    {
      id: 'three-drops',
      title: 'Three Drops',
      reward: 450,
      intro: [
        { who: 'Delia Voss', text: 'Three couriers dropped their bags along the beach this morning. Tide comes in at noon.' },
        { who: 'Delia Voss', text: 'All three bags, Jules. Consider it cardio.' },
      ],
      outro: [
        { who: 'Delia Voss', text: 'Every bag. The beach suits you.' },
      ],
      steps: [
        { kind: 'collect', points: spots.beachDrops, r: 40, label: 'Recover the beach drops' },
      ],
    },
    {
      id: 'borrowed-gt',
      title: 'Borrowed GT',
      reward: 700,
      intro: [
        { who: 'Delia Voss', text: 'A Solano GT sits downtown with the keys in it. Its owner owes me money.' },
        { who: 'Delia Voss', text: 'Take it. The police will object — lose them, then park it at the lockup.' },
      ],
      outro: [
        { who: 'Delia Voss', text: 'Debt collected. You drive like the city owes you money too.' },
      ],
      steps: [
        { kind: 'steal', carTag: 'gt', label: 'Take the Solano GT', setWanted: 2 },
        { kind: 'escape', label: 'Lose the police' },
        { kind: 'goto', x: spots.hideout.x, y: spots.hideout.y, r: 64, need: 'car', label: 'Park the GT at the lockup' },
      ],
    },
    {
      id: 'marisol-job',
      title: 'The Marisol Job',
      reward: 2000,
      intro: [
        { who: 'Delia Voss', text: 'Last one, and it is the big one. Marisol Trust, downtown. The side door sticks. Thirty seconds inside, no more.' },
        { who: 'Delia Voss', text: 'Every badge in the bay will come running. Get to the lockup and we split it. Do not get caught, Jules.' },
      ],
      outro: [
        { who: 'Delia Voss', text: 'You did it. Marisol Bay is yours now — every street of it. The phone stays on: there is always another job.' },
      ],
      steps: [
        { kind: 'goto', x: spots.bankDoor.x, y: spots.bankDoor.y, r: 46, need: 'foot', label: 'Go to the Marisol Trust side door' },
        { kind: 'hold', x: spots.bankDoor.x, y: spots.bankDoor.y, r: 46, seconds: 3, label: 'Empty the drop safe…', setWanted: 4 },
        { kind: 'goto', x: spots.hideout.x, y: spots.hideout.y, r: 70, need: 'any', label: 'Escape to the lockup', time: 180, clearWantedOnArrive: true },
      ],
    },
  ];
}

const COURIER_SPOTS = ['garage', 'port', 'towerDrop', 'hideout', 'hospital', 'station'];

export function createMissionController(spots, rand) {
  const story = storyMissions(spots);
  const ctrl = {
    storyIndex: 0,
    phase: 'intro-dialogue', // intro-dialogue | active | outro-dialogue | between | free
    dialogue: [],
    stepIndex: 0,
    collected: 0,
    holdTime: 0,
    sawHeat: false,
    timer: null,
    betweenTimer: 2.5,
    courier: null,
    storyDone: false,
    failed: false,

    current() {
      if (this.storyDone) return this.courier;
      return story[this.storyIndex] || null;
    },
    step() {
      const m = this.current();
      if (!m || this.phase !== 'active') return null;
      return m.steps[this.stepIndex] || null;
    },
    begin(storyIndex) {
      this.storyIndex = storyIndex;
      this.stepIndex = 0;
      this.collected = 0;
      this.holdTime = 0;
      this.sawHeat = false;
      this.failed = false;
      const m = this.current();
      this.dialogue = m ? [...m.intro] : [];
      this.phase = 'intro-dialogue';
      const step = m && m.steps[0];
      this.timer = step && step.time ? step.time : null;
    },
    beginCourier() {
      const a = rand.pick(COURIER_SPOTS);
      let b = rand.pick(COURIER_SPOTS);
      if (b === a) b = 'hideout';
      const from = spots[a];
      const to = spots[b];
      const dist = Math.hypot(to.x - from.x, to.y - from.y);
      this.courier = {
        id: 'courier',
        title: 'Courier Run',
        reward: Math.round(120 + dist * 0.09),
        intro: [{ who: 'Delia Voss', text: `Quick one: pick up at ${from.label}, drop at ${to.label}. Clock is running.` }],
        outro: [{ who: 'Delia Voss', text: 'Done. Another one whenever you want it.' }],
        steps: [
          { kind: 'goto', x: from.x, y: from.y, r: 62, need: 'any', label: `Pick up at ${from.label}` },
          { kind: 'goto', x: to.x, y: to.y, r: 64, need: 'car', label: `Drop at ${to.label}`, time: Math.round(60 + dist / 22) },
        ],
      };
      this.stepIndex = 0;
      this.collected = 0;
      this.holdTime = 0;
      this.sawHeat = false;
      this.dialogue = [...this.courier.intro];
      this.phase = 'intro-dialogue';
      this.timer = null;
    },
    advanceDialogue() {
      this.dialogue.shift();
      if (this.dialogue.length === 0) {
        if (this.phase === 'intro-dialogue') {
          this.phase = 'active';
          const step = this.step();
          this.timer = step && step.time ? step.time : null;
        } else if (this.phase === 'outro-dialogue') {
          this.phase = 'between';
          this.betweenTimer = 3;
        }
      }
      return this.dialogue.length > 0;
    },
    /** Events the world reports: returns 'crime' hints for the wanted system. */
    notifyEnterCar(car) {
      const step = this.step();
      if (step && step.kind === 'steal' && car.tag === step.carTag) return 'step-done';
      return null;
    },
    fail(reason) {
      this.failed = true;
      this.dialogue = [{ who: 'Delia Voss', text: reason || 'That went sideways. Come back and we run it again.' }];
      this.phase = 'intro-dialogue';
      this.stepIndex = 0;
      this.collected = 0;
      this.holdTime = 0;
      this.sawHeat = false;
      const step = this.current() && this.current().steps[0];
      this.timer = step && step.time ? step.time : null;
    },
    completeStep(game) {
      const m = this.current();
      const step = this.step();
      if (step && step.clearWantedOnArrive) game.clearWanted();
      this.stepIndex += 1;
      this.collected = 0;
      this.holdTime = 0;
      this.sawHeat = false;
      if (this.stepIndex >= m.steps.length) {
        game.addCash(m.reward);
        if (m.unlockGun) game.unlockGun();
        this.dialogue = [...m.outro];
        this.phase = 'outro-dialogue';
        this.timer = null;
        if (!this.storyDone && this.storyIndex >= story.length - 1) this.storyDone = true;
        return 'mission-done';
      }
      const next = this.step();
      this.timer = next && next.time ? next.time : null;
      return 'step-done';
    },
    /** Advance timers and check the active step. Returns an event or null. */
    update(dt, game) {
      if (this.phase === 'between') {
        this.betweenTimer -= dt;
        if (this.betweenTimer <= 0) {
          if (this.storyDone) this.beginCourier();
          else this.begin(this.storyIndex + 1);
          return 'phone';
        }
        return null;
      }
      if (this.phase !== 'active') return null;
      const step = this.step();
      if (!step) return null;
      if (step.time) {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.fail('Out of time. The job is off — come back and we run it again.');
          return 'failed';
        }
      }
      if (game.wanted >= 2) this.sawHeat = true;
      const p = game.playerPos;
      const dist = Math.hypot(p.x - (step.x || 0), p.y - (step.y || 0));
      switch (step.kind) {
        case 'goto': {
          const needOk = step.need === 'any'
            || (step.need === 'car' && game.inCar)
            || (step.need === 'foot' && !game.inCar);
          if (needOk && dist <= step.r) {
            if (step.setWanted) game.raiseWanted(step.setWanted);
            return this.completeStep(game);
          }
          break;
        }
        case 'collect': {
          const points = step.points;
          for (let i = 0; i < points.length; i += 1) {
            if (game.isCollected(i)) continue;
            if (Math.hypot(p.x - points[i].x, p.y - points[i].y) <= step.r) {
              game.collect(i);
              this.collected += 1;
              if (this.collected >= points.length) return this.completeStep(game);
              return 'pickup';
            }
          }
          break;
        }
        case 'hold': {
          if (dist <= step.r && !game.inCar) {
            if (step.setWanted && this.holdTime === 0) game.raiseWanted(step.setWanted);
            this.holdTime += dt;
            if (this.holdTime >= step.seconds) return this.completeStep(game);
          } else {
            this.holdTime = Math.max(0, this.holdTime - dt * 2);
          }
          break;
        }
        case 'escape': {
          if (this.sawHeat && game.wanted === 0) return this.completeStep(game);
          break;
        }
        default:
          break; // 'steal' completes through notifyEnterCar
      }
      return null;
    },
  };
  return ctrl;
}
