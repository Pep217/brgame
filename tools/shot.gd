extends Node2D

## Dev-only screenshot harness (not shipped). Renders the real game entities
## through xvfb + software GL and saves PNGs so the game can be previewed
## without a display. Run via tools/capture.sh.

const BULLET_SCENE := preload("res://scenes/entities/bullet.tscn")

@export var level_path: String = "res://data/levels/level_08.json"
@export var out_dir: String = "user://shots"
@export var prefix: String = "level"

var _room: RoomBuilder
var _fire_origin: Vector2


func _ready() -> void:
	# Allow overrides from the command line: ... res://tools/shot.tscn -- <level_path> <prefix>
	var user_args := OS.get_cmdline_user_args()
	if user_args.size() >= 1:
		level_path = user_args[0]
	if user_args.size() >= 2:
		prefix = user_args[1]

	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(out_dir))

	var cam := Camera2D.new()
	add_child(cam)
	cam.make_current()

	_room = RoomBuilder.new()
	add_child(_room)

	var fx := Node2D.new()
	fx.add_to_group("effects_layer")
	add_child(fx)

	var data := LevelLoader.load_from_file(level_path)
	_room.build(data)
	_fire_origin = _room.fire_origin
	_fit_camera(cam, _room.bounds)

	# Marker for the fire origin so the "before" shot reads clearly.
	var marker := _make_marker()
	add_child(marker)
	marker.position = _fire_origin

	await _settle()
	await _capture("%s_1_aim" % prefix)

	marker.queue_free()

	# Fire the solved shot and let the real physics bullet fly, capturing the
	# ricochet trail as it develops.
	var result := TrajectorySolver.find_best_angle(
		data["fire_origin"], data["walls"], data["enemies"],
		GameplayConstants.SOLVER_KILL_RADIUS,
		GameplayConstants.MAX_BOUNCES,
		GameplayConstants.SOLVER_MAX_DISTANCE,
		GameplayConstants.SOLVER_ANGLE_SAMPLES,
		GameplayConstants.BULLET_RADIUS
	)
	var dir: Vector2 = Vector2.RIGHT.rotated(result["angle"])
	var bullet := BULLET_SCENE.instantiate()
	fx.add_child(bullet)
	bullet.launch(_fire_origin, dir, _room)

	var shot_index := 2
	for wait_time in [0.35, 0.7, 1.2, 2.0]:
		await get_tree().create_timer(wait_time).timeout
		await _settle()
		await _capture("%s_%d_flight" % [prefix, shot_index])
		shot_index += 1

	get_tree().quit()


func _make_marker() -> Node2D:
	var m := Node2D.new()
	var script := GDScript.new()
	script.source_code = """
extends Node2D
func _draw():
	draw_circle(Vector2.ZERO, 9.0, Color(0.3, 1.0, 0.6))
	draw_arc(Vector2.ZERO, 16.0, 0.0, TAU, 20, Color(0.3, 1.0, 0.6, 0.6), 2.0)
"""
	script.reload()
	m.set_script(script)
	return m


func _fit_camera(cam: Camera2D, bounds: Dictionary) -> void:
	var view_size := get_viewport().get_visible_rect().size
	var room_w: float = bounds.get("w", 960.0)
	var room_h: float = bounds.get("h", 540.0)
	var zoom_factor: float = maxf(maxf((room_w + 100.0) / view_size.x, (room_h + 100.0) / view_size.y), 1.0)
	cam.zoom = Vector2.ONE / zoom_factor
	cam.position = Vector2(bounds.get("x", 0.0) + room_w * 0.5, bounds.get("y", 0.0) + room_h * 0.5)


func _settle() -> void:
	await get_tree().process_frame
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw


func _capture(name: String) -> void:
	var img := get_viewport().get_texture().get_image()
	var path := "%s/%s.png" % [out_dir, name]
	img.save_png(path)
	print("saved ", ProjectSettings.globalize_path(path))
