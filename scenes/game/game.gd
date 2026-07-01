extends Node2D

## Orchestrates one room at a time: load -> aim -> fire -> slow-mo flight ->
## win/fail result -> retry or advance. Engine.time_scale is dipped for the
## Superhot-style bullet-time replay while the shot is live, and ramped back
## to 1.0 in real (unscaled) time once it expires.

enum State { AIMING, FLYING, RESULT }

const BULLET_SCENE := preload("res://scenes/entities/bullet.tscn")
const VIEW_MARGIN := 100.0

@onready var camera: Camera2D = $Camera2D
@onready var room_container: RoomBuilder = $RoomContainer
@onready var player_aim = $PlayerAim
@onready var effects_layer: Node2D = $EffectsLayer
@onready var hud = $HUD

var state: State = State.AIMING
var shot_used := false
var bounce_count := 0
var aim_start_usec: int = 0
var current_bullet: Node = null

var _recovering_timescale := false
var _last_real_usec: int = 0


func _ready() -> void:
	effects_layer.add_to_group("effects_layer")
	player_aim.fire_requested.connect(_on_fire_requested)
	room_container.cleared.connect(_on_room_cleared)
	_last_real_usec = Time.get_ticks_usec()
	_load_room()


func _load_room() -> void:
	_clear_current_bullet()
	Engine.time_scale = 1.0
	_recovering_timescale = false

	if GameManager.is_campaign_complete():
		player_aim.enabled = false
		hud.show_campaign_complete()
		return

	var data := GameManager.get_current_level_data()
	if data.is_empty():
		return

	room_container.build(data)
	_fit_camera(room_container.bounds)
	player_aim.fire_origin = room_container.fire_origin
	player_aim.position = room_container.fire_origin
	player_aim.enabled = true

	state = State.AIMING
	shot_used = false
	bounce_count = 0
	aim_start_usec = Time.get_ticks_usec()
	hud.reset_for_new_room(String(data.get("name", "")), room_container.total_enemy_count())


func _fit_camera(bounds: Dictionary) -> void:
	var view_size := get_viewport_rect().size
	var room_w: float = bounds.get("w", 960.0)
	var room_h: float = bounds.get("h", 540.0)
	var zoom_x: float = (room_w + VIEW_MARGIN) / view_size.x
	var zoom_y: float = (room_h + VIEW_MARGIN) / view_size.y
	var zoom_factor: float = maxf(maxf(zoom_x, zoom_y), 1.0)
	camera.zoom = Vector2.ONE / zoom_factor
	camera.position = Vector2(bounds.get("x", 0.0) + room_w * 0.5, bounds.get("y", 0.0) + room_h * 0.5)


func _on_fire_requested(direction: Vector2) -> void:
	if state != State.AIMING or shot_used:
		return
	shot_used = true
	state = State.FLYING
	player_aim.enabled = false

	var aim_time: float = (Time.get_ticks_usec() - aim_start_usec) / 1_000_000.0
	Engine.time_scale = GameplayConstants.SLOWMO_SCALE
	_recovering_timescale = false

	current_bullet = BULLET_SCENE.instantiate()
	effects_layer.add_child(current_bullet)
	current_bullet.bounced.connect(_on_bullet_bounced)
	current_bullet.expired.connect(_on_bullet_expired.bind(aim_time))
	current_bullet.launch(room_container.fire_origin, direction, room_container)
	hud.show_bounce_counter(true)


func _on_bullet_bounced(count: int) -> void:
	bounce_count = count
	hud.update_bounces(bounce_count)


func _on_bullet_expired(enemies_remaining: int, aim_time: float) -> void:
	if state == State.RESULT:
		return
	state = State.RESULT
	_recovering_timescale = true

	var win := enemies_remaining <= 0
	if win:
		var result := ScoreCalc.compute(room_container.total_enemy_count(), bounce_count, room_container.par_bounces, aim_time)
		GameManager.advance_after_win(result)
		hud.show_result(true, result, aim_time)
	else:
		hud.show_result(false, {}, aim_time)


func _on_room_cleared() -> void:
	pass # The bullet reads room_container.enemies_remaining() itself on expiry.


func _process(_delta: float) -> void:
	var now := Time.get_ticks_usec()
	var real_delta: float = (now - _last_real_usec) / 1_000_000.0
	_last_real_usec = now
	if _recovering_timescale:
		var rate: float = (1.0 - GameplayConstants.SLOWMO_SCALE) / GameplayConstants.SLOWMO_RECOVER_SECONDS
		Engine.time_scale = minf(1.0, Engine.time_scale + real_delta * rate)
		if Engine.time_scale >= 1.0:
			Engine.time_scale = 1.0
			_recovering_timescale = false


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		Engine.time_scale = 1.0
		GameManager.goto_main_menu()
		return
	if event.is_action_pressed("restart"):
		_load_room()
		return
	if state == State.RESULT and event.is_action_pressed("fire"):
		_load_room()


func _clear_current_bullet() -> void:
	if current_bullet != null and is_instance_valid(current_bullet):
		current_bullet.queue_free()
	current_bullet = null
