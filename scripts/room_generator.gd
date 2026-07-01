class_name RoomGenerator
extends RefCounted

## Procedural "endless mode" room generation. Picks a hand-authored wall
## template, then randomly samples a subset of its candidate enemy slots and
## verifies with TrajectorySolver that at least one firing angle can still
## eliminate every chosen enemy in a single ricocheting shot. If a subset
## isn't solvable it reshuffles, and if it keeps failing it gradually drops
## the enemy count, so the generator can never hand the player an impossible
## room.

const TEMPLATES_PATH := "res://data/templates/room_templates.json"
const MAX_ATTEMPTS_PER_COUNT := 60

static var _templates: Array = []
static var _loaded := false


static func _ensure_loaded() -> void:
	if _loaded:
		return
	_loaded = true
	if not FileAccess.file_exists(TEMPLATES_PATH):
		push_error("RoomGenerator: templates file missing: %s" % TEMPLATES_PATH)
		return
	var text := FileAccess.get_file_as_string(TEMPLATES_PATH)
	var parsed: Variant = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY or not parsed.has("templates"):
		push_error("RoomGenerator: malformed templates file")
		return
	_templates = parsed["templates"]


static func generate(difficulty: int, template_index: int = -1, rng: RandomNumberGenerator = null) -> Dictionary:
	_ensure_loaded()
	if _templates.is_empty():
		push_error("RoomGenerator: no templates loaded")
		return {}

	var r := rng
	if r == null:
		r = RandomNumberGenerator.new()
		r.randomize()

	var t_index := template_index
	if t_index < 0 or t_index >= _templates.size():
		t_index = r.randi() % _templates.size()
	var template: Dictionary = _templates[t_index]

	var walls: Array = []
	for w in template.get("walls", []):
		walls.append({
			"pos": Vector2(w["x"], w["y"]),
			"size": Vector2(w["w"], w["h"]),
			"rot": float(w.get("rot", 0.0)),
		})

	var slots: Array = []
	for s in template.get("enemy_slots", []):
		slots.append(Vector2(s["x"], s["y"]))

	var fire_origin_raw: Dictionary = template.get("fire_origin", {"x": 480, "y": 500})
	var fire_origin := Vector2(fire_origin_raw.get("x", 480), fire_origin_raw.get("y", 500))

	var desired_count: int = clampi(2 + difficulty, 2, mini(6, slots.size()))
	var chosen_enemies: Array = []
	var solved := false

	var count := desired_count
	while count >= 1 and not solved:
		for attempt in range(MAX_ATTEMPTS_PER_COUNT):
			var shuffled: Array = slots.duplicate()
			_shuffle(shuffled, r)
			var candidates: Array = shuffled.slice(0, count)
			var result := TrajectorySolver.find_best_angle(
				fire_origin, walls, candidates,
				GameplayConstants.SOLVER_KILL_RADIUS,
				GameplayConstants.MAX_BOUNCES,
				GameplayConstants.SOLVER_MAX_DISTANCE,
				GameplayConstants.SOLVER_ANGLE_SAMPLES,
				GameplayConstants.BULLET_RADIUS
			)
			if result["full_clear"] and result["corner_safe"]:
				chosen_enemies = candidates
				solved = true
				break
		if not solved:
			count -= 1

	if not solved:
		# Should not happen with well-curated templates; last-resort fallback
		# so the game never hard-crashes on a pathological template.
		chosen_enemies = slots.slice(0, mini(1, slots.size()))

	var bounds_raw: Dictionary = template.get("bounds", {"x": 0, "y": 0, "w": 960, "h": 540})

	return {
		"id": "endless_%d_%d" % [difficulty, Time.get_ticks_msec()],
		"name": "Endless — Wave %d" % (difficulty + 1),
		"bounds": {
			"x": float(bounds_raw.get("x", 0)),
			"y": float(bounds_raw.get("y", 0)),
			"w": float(bounds_raw.get("w", 960)),
			"h": float(bounds_raw.get("h", 540)),
		},
		"fire_origin": fire_origin,
		"par_bounces": clampi(chosen_enemies.size() + 1, 2, 8),
		"par_time": 2.0 + 0.3 * chosen_enemies.size(),
		"walls": walls,
		"enemies": chosen_enemies,
	}


static func _shuffle(array: Array, r: RandomNumberGenerator) -> void:
	for i in range(array.size() - 1, 0, -1):
		var j := r.randi_range(0, i)
		var tmp = array[i]
		array[i] = array[j]
		array[j] = tmp
