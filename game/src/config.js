// Solmar Heat — tuning numbers, palette, city size and key bindings.
// Solmar is a fictional sun-soaked coastal city. Every number that shapes how
// the game feels lives here so the other modules stay small and readable.

export const CONFIG = {
  // World and view
  WORLD_W: 3200,
  WORLD_H: 3200,
  VIEW_W: 1280,
  VIEW_H: 800,

  // City layout
  ROAD_SPACING: 400,
  ROAD_W: 72,
  SIDEWALK: 16,
  FIRST_ROAD: 200,
  BEACH_Y: 2740,
  SEA_Y: 2960,

  // Sunset palette: warm orange, teal sea, deep navy shadows.
  PALETTE: {
    ground: '#c9b183',
    grass: '#7fae62',
    parkGreen: '#6da356',
    road: '#33363f',
    roadEdge: '#262932',
    laneLine: '#e8d27a',
    sidewalk: '#b8a98a',
    sand: '#ecd096',
    sea: '#1f7d8c',
    seaDeep: '#14606e',
    foam: '#d8f2ee',
    plaza: '#c7b299',
    buildingRoof: ['#c96f4a', '#d9a05b', '#5b8a8a', '#b5533c', '#8a6f8e', '#e0c184', '#4f7d6b', '#a34d5e'],
    buildingWall: ['#e8d9b8', '#dfc39a', '#cdb98f', '#e3cfa8'],
    windowLit: '#ffd98a',
    windowDark: '#3c4a63',
    hudBg: 'rgba(12, 18, 32, 0.72)',
    hudText: '#ffe9c4',
    accent: '#ff9a3c',
    star: '#ffd23e',
  },

  // Player on foot
  PLAYER: {
    walkSpeed: 185,
    radius: 13,
    health: 100,
    punchDamage: 0,
  },

  // Driving
  CAR: {
    accel: 420,
    brake: 620,
    reverseAccel: 260,
    maxSpeed: 520,
    maxReverse: 170,
    turnRate: 2.6,
    grip: 3.2,
  },

  // Police
  POLICE: {
    cruiserSpeed: 470,
    cruiserTurn: 2.9,
    ramDamage: 8,
    arrestTime: 1.6,
    sightRange: 620,
  },

  // Combat
  COMBAT: {
    bulletSpeed: 900,
    bulletLife: 0.7,
    playerDamage: 34,
    thugDamage: 9,
    copDamage: 7,
    fireRate: 0.16,
  },

  // Wanted level
  WANTED: {
    decaySeconds: 9,
    maxStars: 5,
  },

  // Traffic and pedestrians
  TRAFFIC_CARS: 16,
  PEDS: 26,
  PICKUP_COUNT: 8,

  // Mission rewards
  REWARD_M1: 500,
  REWARD_M2: 1200,
  REWARD_M3: 2500,

  // Key bindings (KeyboardEvent.code)
  KEYS: {
    up: ['KeyW', 'ArrowUp'],
    down: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    enterCar: 'KeyE',
    shoot: 'Space',
    pause: ['KeyP', 'Escape'],
    mute: 'KeyM',
    confirm: 'Enter',
  },
};
