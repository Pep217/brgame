#!/usr/bin/env bash
# Render preview screenshots of the game without a display, using a virtual
# X server (xvfb) and Mesa software GL (llvmpipe). Useful on headless/CI boxes.
#
# Usage:
#   GODOT_BIN=/path/to/godot tools/capture.sh
#
# Output PNGs land in the Godot user data dir, printed at the end.
set -euo pipefail

GODOT_BIN="${GODOT_BIN:-godot}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export LIBGL_ALWAYS_SOFTWARE=1
export GALLIUM_DRIVER=llvmpipe

run() {
	xvfb-run -a -s "-screen 0 1152x648x24" "$GODOT_BIN" \
		--path "$PROJECT_DIR" --rendering-driver opengl3 --resolution 1152x648 "$@"
}

# Ensure imports exist so class_name scripts resolve.
"$GODOT_BIN" --headless --editor --quit --path "$PROJECT_DIR" >/dev/null 2>&1 || true

echo "Capturing main menu..."
run res://tools/snap.tscn 2>&1 | grep -iE "^saved|SCRIPT ERROR" || true

echo "Capturing gameplay (zigzag)..."
run res://tools/shot.tscn -- res://data/levels/level_08.json zig 2>&1 | grep -iE "^saved|SCRIPT ERROR" || true

echo "Capturing gameplay (gauntlet)..."
run res://tools/shot.tscn -- res://data/levels/level_10.json gaunt 2>&1 | grep -iE "^saved|SCRIPT ERROR" || true

echo "Done. PNGs:"
find "$HOME/.local/share/godot" -name "*.png" 2>/dev/null | sort || true
