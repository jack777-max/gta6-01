[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/jack777-max/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/jack777-max/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Marisol Nights

Entry for the make.fun bounty **"Make GTA 6"**
(https://make.fun/bounty/gta6-01).

**Marisol Nights** is a complete open-world crime game that plays offline in a
desktop browser from static files. You are Jules Marlowe, new in the
sun-soaked city of Marisol Bay, running jobs for fixer Delia Voss across five
story missions — steal a Comet Coupe, move a quiet package, recover three
beach drops, borrow a Solano GT and lose the police, then empty the Marisol
Trust and escape — with endless courier work after the story ends.

The whole genre is wired together: a generated coastal city (downtown towers,
a working port, suburbs, a park, pastel beachfront hotels, sand and sea) to
explore on foot and by car; living traffic that stops, turns and brakes for
you; pedestrians who stroll, panic and flee; any car yours to take, parked or
still occupied; fists and a pistol; a five-star wanted system with police who
chase, ram, shoot at high heat and bust you if you slow down; cash, bail and
hospital bills; a HUD with a live minimap; synthesised engine, siren, gunfire
and a synthwave loop — no audio files, no network, no libraries. The game
saves itself after every job.

## Play it

```
node serve.ts          # serves game/ at http://localhost:8080
```

Then open http://localhost:8080 in a desktop browser. WASD or arrows to walk
and drive, Shift to run, F to enter a car, J or the mouse button to fight and
shoot, P to pause.

## Hand it in

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to the output directory and writes `dossier.json` with the vendored
`vendor/makefun-game.ts` library.

## Layout

- `game/index.html` — the page
- `game/src/config.js` — every tuning number and colour
- `game/src/city.js` — the generated city and its pre-rendered ground
- `game/src/world.js` — the simulation: driving, traffic, police, wanted, combat
- `game/src/missions.js` — Delia's story missions and the courier jobs
- `game/src/render.js` — the renderer, HUD, minimap and screens
- `game/src/audio.js` — all sound, synthesised with WebAudio
- `game/src/input.js`, `game/src/random.js`, `game/src/shots.js`, `game/src/main.js`

MIT licensed.
