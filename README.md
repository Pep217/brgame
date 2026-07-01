# Ricochet Protocol

A one-bullet, physics-based puzzle shooter. Every room gives you exactly one
shot: aim, fire, and watch it ricochet off the walls in bullet-time. Clear
every enemy before it expires or the room resets — Hotline Miami's instant
retry loop meets billiards.

Built in **Godot 4.3** (GDScript, GL Compatibility renderer).

## Controls

- **Mouse** — aim
- **Left Click / Space** — fire (one shot per room)
- **R** — instant restart of the current room
- **Esc** — back to main menu

## Running it

Open the project folder in the Godot 4.3 editor and hit Play, or headless:

```
godot --headless --path . res://scenes/main_menu/main_menu.tscn
```

## How the puzzle guarantee works

Every room — hand-authored or procedurally generated — is checked by
`scripts/trajectory_solver.gd`, a pure-math ricochet simulator, before it's
considered valid. It scans hundreds of firing angles and confirms at least
one clears every enemy in a single bounce path, while also flagging
solutions that depend on grazing a wall corner exactly (where the sharp
corner math and Godot's real rounded-corner physics can disagree) so only
genuinely reliable solutions are accepted. `scripts/room_generator.gd` uses
the same solver to keep reshuffling procedurally-placed enemies until it
finds a solvable layout, so Endless Mode can never hand out an impossible
room.

Two automated checks enforce this for every level in `data/levels/`:

```
godot --headless --script res://tests/level_autotest.gd       # math model
godot --headless --path . res://tests/physics_autotest.tscn   # real physics
```

Run both after adding or editing a level — see `docs/LEVEL_FORMAT.md`.

## Project layout

```
autoload/         GameManager, SaveData, SteamManager (see docs/STEAM_INTEGRATION.md)
scripts/          Engine-agnostic logic: trajectory solver, room generator,
                  level loader, score calculator, room builder
scenes/
  main_menu/      Title screen, campaign/endless entry points
  game/           Game.gd (per-room state machine), HUD, aiming
  entities/       Bullet, Enemy, Wall
  effects/        Particle bursts (hit / wall bounce)
data/
  levels/         Hand-authored campaign levels (JSON)
  templates/      Wall layouts + enemy slot pools for procedural generation
tests/            Headless validators (see above)
docs/             Level format spec, Steam integration notes
```

## Modes

- **Campaign** — 10 hand-authored levels, increasing in complexity (direct
  shots → pillars → banked corners → multi-enemy chains). Progress, best
  grade and score per level persist to `user://savegame.json`.
- **Endless** — procedurally generated rooms, difficulty (enemy count)
  ramps with your streak. Best streak/score persist locally.

Scoring is Hotline-Miami-style: base points per kill, a bonus for using
fewer bounces, a bonus for aiming quickly, rolled into a letter grade
(S/A/B/C/D) per room.
