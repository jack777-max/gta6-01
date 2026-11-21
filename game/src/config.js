// Every tuning number and colour for Marisol Nights in one place. The view is a
// fixed 1280x720 logical area; the renderer scales it to the window, and the
// world is a city of road grids measured in the same pixels.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second at any refresh rate. */
export const STEP = 1 / 60;

/** City layout: blocks on a 360 px pitch, 120 px of road between them. */
export const CITY = {
  pitch: 360,
  road: 120,
  block: 240,
  cols: 11,
  rows: 8,
};
export const WORLD = {
  width: CITY.pitch * CITY.cols + CITY.road,
  height: CITY.pitch * CITY.rows + CITY.road,
};
/** The sea starts here; east of it is water, west of the sand strip is city. */
export const BEACH_X = WORLD.width - 460;
export const WATER_X = WORLD.width - 250;

export const PLAYER = {
  radius: 13,
  walkSpeed: 148,
  runSpeed: 252,
  maxHealth: 100,
  punchRange: 46,
  punchCooldown: 0.34,
  shotCooldown: 0.27,
};

export const CAR = {
  length: 46,
  width: 22,
  accel: 340,
  brake: 520,
  drag: 0.55,
  maxReverse: 90,
  grip: 3.4,
};

export const WANTED = {
  max: 5,
  /** Seconds without a fresh crime before the heat can cool at all. */
  coolDelay: 16,
  /** Seconds out of police sight per star dropped while cooling. */
  coolPerStar: 11,
  sightRange: 380,
};

export const POLICE = {
  maxCars: 6,
  bustRangeFoot: 52,
  bustRangeCar: 74,
  bustFill: 0.85,
  bustDecay: 1.6,
  shootRange: 250,
};

export const PALETTE = {
  sky: '#f7c873',
  water: '#1f9db4',
  waterDeep: '#157d99',
  sand: '#f2d492',
  grass: '#79b657',
  parkGrass: '#5da244',
  road: '#3c414d',
  roadEdge: '#565d6d',
  sidewalk: '#cbb9a0',
  lane: '#f5e9c8',
  night: '#232946',
  text: '#fff7e8',
  muted: '#cdbfa8',
  accent: '#ff5d7e',
  gold: '#ffc53d',
  teal: '#2ec4b6',
  panel: 'rgba(16,18,32,0.78)',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

/** Where the save game is kept between visits (this browser only). */
export const SAVE_KEY = 'marisol-nights.save.v1';

/** Car models: name, colour set, speed class and price flavour for the HUD. */
export const CAR_MODELS = [
  { name: 'Comet Coupe', top: 265, accel: 1.25, colours: ['#e8452c', '#f28c28', '#ffd23f', '#7bc950'] },
  { name: 'Bayside Sedan', top: 215, accel: 1.0, colours: ['#dfe3e6', '#8fa3b8', '#33566e', '#6e3333'] },
  { name: 'Palmetto Hatch', top: 195, accel: 0.92, colours: ['#4fb0c6', '#e6e6e6', '#88c057', '#c6549c'] },
  { name: 'Hauler Van', top: 175, accel: 0.8, colours: ['#e8e4da', '#b8b0a0', '#5b7a8c'] },
  { name: 'Solano GT', top: 305, accel: 1.45, colours: ['#ffcf3f', '#ff5d7e', '#22242e', '#f4f4f4'] },
];
