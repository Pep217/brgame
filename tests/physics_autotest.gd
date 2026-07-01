extends Node

## Deeper integration check than level_autotest.gd: actually spawns the real
## Wall/Enemy/Bullet scenes and lets Godot's physics engine fly the bullet at
## the angle TrajectorySolver picked, then confirms every enemy really dies
## in-engine (not just in the idealized math model). Run via:
##   godot --headless --path . res://tests/physics_autotest.tscn

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

const BULLET_SCENE := preload("res://scenes/entities/bullet.tscn")


func _ready() -> void:
	var all_ok := true
	for path in LEVEL_FILES:
		var ok: bool = await _test_level(path)
		print("%s  %s" % ["PASS" if ok else "FAIL", path])
		if not ok:
			all_ok = false

	print("=== PHYSICS RESULT: %s ===" % ("ALL PASSED" if all_ok else "FAILURES DETECTED"))
	get_tree().quit(0 if all_ok else 1)


func _test_level(path: String) -> bool:
	var data := LevelLoader.load_from_file(path)
	if data.is_empty():
		return false

	var room := RoomBuilder.new()
	add_child(room)
	room.build(data)

	var result := TrajectorySolver.find_best_angle(
		data["fire_origin"], data["walls"], data["enemies"],
		GameplayConstants.SOLVER_KILL_RADIUS,
		GameplayConstants.MAX_BOUNCES,
		GameplayConstants.SOLVER_MAX_DISTANCE,
		GameplayConstants.SOLVER_ANGLE_SAMPLES,
		GameplayConstants.BULLET_RADIUS
	)
	if not result["full_clear"]:
		room.queue_free()
		return false

	var dir: Vector2 = Vector2.RIGHT.rotated(result["angle"])
	var bullet := BULLET_SCENE.instantiate()
	add_child(bullet)
	bullet.launch(data["fire_origin"], dir, room)

	await bullet.expired

	var cleared: bool = room.enemies_remaining() == 0
	room.queue_free()
	return cleared
