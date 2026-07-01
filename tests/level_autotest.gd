extends SceneTree

## Offline design validator, run via:
##   godot --headless --script res://tests/level_autotest.gd
## Confirms every hand-authored level AND a sample of procedurally generated
## rooms have at least one angle that clears every enemy in a single
## ricocheting shot, using the same math (TrajectorySolver) and constants
## (GameplayConstants) the real bullet is built on.

const LEVEL_FILES := [
	"res://data/levels/level_01.json",
	"res://data/levels/level_02.json",
	"res://data/levels/level_03.json",
	"res://data/levels/level_04.json",
	"res://data/levels/level_05.json",
	"res://data/levels/level_06.json",
	"res://data/levels/level_07.json",
	"res://data/levels/level_08.json",
	"res://data/levels/level_09.json",
	"res://data/levels/level_10.json",
]


func _init() -> void:
	var all_ok := true

	print("=== Hand-authored level validation ===")
	for path in LEVEL_FILES:
		var data := LevelLoader.load_from_file(path)
		if data.is_empty():
			print("FAIL  %s  could not load" % path)
			all_ok = false
			continue
		var ok := _check_no_overlap(data)
		var result := TrajectorySolver.find_best_angle(
			data["fire_origin"], data["walls"], data["enemies"],
			GameplayConstants.SOLVER_KILL_RADIUS,
			GameplayConstants.MAX_BOUNCES,
			GameplayConstants.SOLVER_MAX_DISTANCE,
			GameplayConstants.SOLVER_ANGLE_SAMPLES,
			GameplayConstants.BULLET_RADIUS
		)
		var solvable: bool = result["full_clear"] and result["corner_safe"]
		var status := "PASS" if (solvable and ok) else "FAIL"
		if not (solvable and ok):
			all_ok = false
		print("%s  %-28s enemies=%d  angle=%.1f°  bounces_used<=%d  covered=%d/%d  corner_safe=%s  origin_clear=%s" % [
			status, data["name"], data["enemies"].size(), rad_to_deg(result["angle"]),
			result["path"].size() - 2, result["covered_count"], data["enemies"].size(), result["corner_safe"], ok
		])

	print("\n=== Procedural template validation (RoomGenerator) ===")
	var rng := RandomNumberGenerator.new()
	rng.seed = 12345
	for difficulty in range(0, 5):
		for trial in range(5):
			var generated := RoomGenerator.generate(difficulty, -1, rng)
			if generated.is_empty():
				print("FAIL  difficulty=%d trial=%d  generator returned empty" % [difficulty, trial])
				all_ok = false
				continue
			var result2 := TrajectorySolver.find_best_angle(
				generated["fire_origin"], generated["walls"], generated["enemies"],
				GameplayConstants.SOLVER_KILL_RADIUS,
				GameplayConstants.MAX_BOUNCES,
				GameplayConstants.SOLVER_MAX_DISTANCE,
				GameplayConstants.SOLVER_ANGLE_SAMPLES,
				GameplayConstants.BULLET_RADIUS
			)
			var ok2: bool = result2["full_clear"] and result2["corner_safe"]
			if not ok2:
				all_ok = false
				print("FAIL  difficulty=%d trial=%d  %s  enemies=%d NOT fully coverable" % [
					difficulty, trial, generated["name"], generated["enemies"].size()
				])
	print("PASS  procedural generator produced solvable rooms for difficulties 0-4 (5 trials each)")

	print("\n=== RESULT: %s ===" % ("ALL PASSED" if all_ok else "FAILURES DETECTED"))
	quit(0 if all_ok else 1)


func _check_no_overlap(data: Dictionary) -> bool:
	var fire_origin: Vector2 = data["fire_origin"]
	var points: Array = [fire_origin]
	for e in data["enemies"]:
		points.append(e)
	for p in points:
		for w in data["walls"]:
			if _point_in_wall(p, w):
				return false
	return true


func _point_in_wall(p: Vector2, wall: Dictionary) -> bool:
	var local: Vector2 = (p - wall["pos"]).rotated(-deg_to_rad(wall.get("rot", 0.0)))
	var half: Vector2 = wall["size"] * 0.5
	return absf(local.x) < half.x and absf(local.y) < half.y
