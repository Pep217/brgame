# tools/ — dev preview utilities

Not part of the shipped game. These render preview screenshots of the real
game scenes on a headless machine (no GPU/display needed), using a virtual X
server (xvfb) and Mesa software GL (llvmpipe).

## Usage

```bash
GODOT_BIN=/path/to/godot bash tools/capture.sh
```

Output PNGs are written to Godot's user data dir and their full paths are
printed at the end.

## Files

- `capture.sh` — runs everything under xvfb + llvmpipe.
- `snap.gd` / `snap.tscn` — instance any scene, settle, save one PNG (used
  for the main menu).
- `shot.gd` / `shot.tscn` — build a real room, fire the solver's shot through
  the actual physics bullet, and capture the ricochet trail at several
  moments. Level is passed after `--`:
  `godot ... res://tools/shot.tscn -- res://data/levels/level_08.json myprefix`

## Requirements

`xvfb` and Mesa (`libgl1-mesa-dri`) must be installed. On Debian/Ubuntu:
`apt-get install xvfb libgl1-mesa-dri`.
