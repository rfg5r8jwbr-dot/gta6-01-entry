# Solmar Heat — an open-world crime game

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?ref=4q7hssxn)
[![rank](https://make.fun/badge/gta6-01/rfg5r8jwbr-dot/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01?ref=4q7hssxn)
[![reward](https://make.fun/badge/gta6-01/rfg5r8jwbr-dot/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?ref=4q7hssxn)

A top-down 2D open-world crime game in the spirit of GTA 6, built for the make.fun bounty [gta6-01](https://make.fun/bounty/gta6-01). Rio Calder is back in Solmar, a fictional sun-soaked coastal city. Lena Cruz has work for him, Mr. Delgado has a problem on the beach, and the Solmar PD has other ideas.

## What is in the game

- **A city to explore** — an 8×8 road grid of avenues and streets, three districts (low Old Town, Downtown towers around the Solmar Tower, Marina by the sea), blocks of buildings with lit windows and rooftop pools, AC units and a helipad, a park, a plaza with a fountain, a beach and a teal sea with animated waves.
- **On foot and by car** — walk the pavements, steal any sedan, taxi, truck or sports car with E, and drive it with arcade handling (accelerate, brake, reverse, steer, off-road drag).
- **Traffic and pedestrians** — 28 cars drive the grid on the right-hand lane, turn at junctions and brake for the car ahead; 45 pedestrians stroll the pavements (crowds gather at the plaza and the park) and flee from gunfire. Wrecked cars are towed after 20 seconds instead of blocking the lane forever.
- **A wanted level and police** — stealing, hitting bystanders and shooting raise your stars (0–5). Police cruisers chase and ram you; on-foot cops run you down and arrest you. Lose sight of them and the heat decays.
- **Missions and a story** — three jobs with dialogue from Lena Cruz and Mr. Delgado: M1 First Wheels (steal a car, bring it to Lena), M2 The Pickup (run a package across town with the PD on you), M3 Beachfront Heat (a shootout on the sand, then a getaway to the hideout). Each pays out; after the story, repeatable taxi fares keep appearing in free roam — pick up the passenger, drop them off, get paid.
- **Combat** — aim with the mouse, shoot with Space or click, on foot and from the car (drive-by shooting, slower fire rate). Bullets, muzzle flash, sparks, smoke and damage to cars, people and buildings. The beach crew dodges cars and cannot be run over — they have to be shot.
- **A HUD with a minimap** — health, money, wanted stars, mission objective, speed, the clock, an objective arrow, dialogue banners and mission-complete cards. The minimap shows roads, buildings, the sea, police dots and the mission marker. HUD text sits on backing panels so it stays readable over the world.
- **Sound, all procedural** — engine hum, a two-tone siren, gunshots, pickup blips, mission jingles and a slow bass loop, made with WebAudio and nothing else. M mutes.
- **A start and a save** — title screen with controls, pause on P/Esc or when the tab hides, busted/wasted screens, and progress (money, missions) saved to localStorage with Continue on the title screen.

## How to play

```sh
node serve.ts
```

Then open http://localhost:8080. The game is static files under `game/` and works with the network off; it loads no external script, image, font or sound.

## Controls

- **WASD / arrows** — move on foot; drive (W accelerate, S brake/reverse, A/D steer)
- **E** — steal / enter a car, exit a car
- **Mouse** — aim; **Space or click** — shoot (on foot, and from the car at a slower rate)
- **P or Esc** — pause; **M** — mute; **Enter** — start / confirm; **C** — continue a save

## Tech notes

Plain Canvas 2D and ES modules, no library and no build step. The source is split into one file per job: `config.js` (tuning and palette), `random.js` (seeded RNG), `city.js` (city generation and collisions), `vehicles.js` (cars, traffic AI, police), `people.js` (pedestrians, cops, thugs), `player.js` (on foot and driving), `combat.js` (shooting and damage), `missions.js` (story), `world.js` (the fixed 1/60s simulation), `audio.js` (procedural WebAudio), `render.js` (drawing, HUD, minimap, screens), `input.js`, `shots.js` (staged screenshot scenes), `save.js`, `main.js` (boot, loop, self-test).

Screenshots are staged scenes of the real simulation: `?shot=cover|beach|chase|mission&seed=1` plays the game forward with a scripted autopilot and sets `window.__shotReady`. `?selftest=1` runs a scripted play-through (walk, steal, drive, finish mission 1, shoot, police response, save) and writes `SELFTEST PASS` or `SELFTEST FAIL` into the document title.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Everything in the game — the city of Solmar, Rio Calder, Lena Cruz, Mr. Delgado, the cars, the story, the art and the sounds — is original and made for this entry. Nothing is taken from any commercial game.
