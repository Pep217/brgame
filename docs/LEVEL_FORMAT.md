# Level JSON format

Every hand-authored level lives in `data/levels/*.json` and is loaded by
`scripts/level_loader.gd`. Procedurally generated rooms
(`scripts/room_generator.gd`) produce the same in-memory shape from
`data/templates/room_templates.json`, so `RoomBuilder` never needs to know
where a room came from.

## Level file

```json
{
  "id": "level_01",
  "name": "01 — First Contact",
  "bounds": { "x": 0, "y": 0, "w": 960, "h": 540 },
  "fire_origin": { "x": 480, "y": 480 },
  "par_bounces": 1,
  "par_time": 3.0,
  "walls": [
    { "x": 480, "y": 12, "w": 960, "h": 24 },
    { "x": 480, "y": 12, "w": 960, "h": 24, "rot": 0 }
  ],
  "enemies": [
    { "x": 480, "y": 150 }
  ]
}
```

- `bounds` — room extent, used to fit the camera. Keep a sealed perimeter
  wall matching these bounds so the bullet can never leave the room.
- `fire_origin` — where the player's reticle/shot originates.
- `par_bounces` / `par_time` — scoring reference values (see
  `scripts/score_calculator.gd`), not hard limits.
- `walls` — list of oriented boxes: `x`/`y` is the **center** (not
  top-left), `w`/`h` the full size, `rot` an optional rotation in degrees
  (default 0).
- `enemies` — list of `{x, y}` center points. One Enemy scene is spawned per
  entry.

## Solvability

Every level shipped in `data/levels/` is verified solvable in a single
ricocheting shot by two automated checks:

- `tests/level_autotest.gd` — a pure-math check using
  `scripts/trajectory_solver.gd`. Run it with:
  ```
  godot --headless --script res://tests/level_autotest.gd
  ```
- `tests/physics_autotest.tscn` — fires an actual `Bullet` scene through
  Godot's real physics at the angle the solver found, confirming the two
  models agree. Run it with:
  ```
  godot --headless --path . res://tests/physics_autotest.tscn
  ```

Run both after adding or editing a level. `TrajectorySolver` treats a
solution as trustworthy only when it's both `full_clear` (hits every enemy)
and `corner_safe` (never depends on a bounce landing exactly on a wall
corner, where the sharp-corner math model and Godot's real rounded-corner
collision can disagree) — see the comment at the top of
`scripts/trajectory_solver.gd` for why that distinction exists.

## Procedural templates

`data/templates/room_templates.json` holds wall layouts plus a pool of
candidate `enemy_slots` per template. `RoomGenerator.generate(difficulty)`
picks a template, samples a subset of slots sized to the difficulty, and
uses `TrajectorySolver` to confirm the subset is fully clearable before
handing it to `RoomBuilder` — retrying with fewer enemies if it can't find a
solution, so Endless Mode can never hand the player an impossible room.
