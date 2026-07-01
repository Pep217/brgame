extends CharacterBody2D

## The one shot. Moves in a straight line, reflects off walls using real
## physics collision normals (Vector2.bounce), and kills any enemy its
## HitArea overlaps without stopping. Expires after a bounce cap or a
## lifetime timer, whichever comes first.

signal bounced(bounce_count: int)
signal expired(enemies_remaining: int)

const RADIUS := GameplayConstants.BULLET_RADIUS
const COLOR := Color(1.0, 0.95, 0.4)
const TRAIL_FADE_TIME := 0.6
const MAX_SUBSTEPS := 4

@onready var hit_area: Area2D = $HitArea
@onready var trail: Line2D = $Trail
@onready var lifetime_timer: Timer = $LifetimeTimer

var bounce_count := 0
var _expired := false
var _room: Node = null


func _ready() -> void:
	hit_area.area_entered.connect(_on_hit_area_entered)
	lifetime_timer.wait_time = GameplayConstants.MAX_LIFETIME
	lifetime_timer.one_shot = true
	lifetime_timer.timeout.connect(_on_lifetime_timeout)
	lifetime_timer.start()
	trail.clear_points()


func launch(start_position: Vector2, direction: Vector2, room: Node) -> void:
	_room = room
	global_position = start_position
	velocity = direction.normalized() * GameplayConstants.BULLET_SPEED
	trail.add_point(global_position)


func _physics_process(delta: float) -> void:
	if _expired:
		return

	var remaining_motion := velocity * delta
	var iterations := 0
	while remaining_motion.length() > 0.01 and iterations < MAX_SUBSTEPS:
		iterations += 1
		var collision := move_and_collide(remaining_motion)
		if collision == null:
			remaining_motion = Vector2.ZERO
			break
		var normal := collision.get_normal()
		_spawn_spark(collision.get_position(), normal)
		remaining_motion = (remaining_motion - collision.get_travel()).bounce(normal)
		velocity = velocity.bounce(normal)
		bounce_count += 1
		bounced.emit(bounce_count)
		if bounce_count >= GameplayConstants.MAX_BOUNCES:
			expire()
			return

	trail.add_point(global_position)


func _on_hit_area_entered(area: Area2D) -> void:
	if area.is_in_group("enemy") and area.has_method("kill"):
		area.kill()


func _on_lifetime_timeout() -> void:
	expire()


func enemies_remaining() -> int:
	if _room != null and _room.has_method("enemies_remaining"):
		return _room.enemies_remaining()
	return 0


func expire() -> void:
	if _expired:
		return
	_expired = true
	set_physics_process(false)
	queue_redraw()
	var remaining := enemies_remaining()
	expired.emit(remaining)
	var tween := create_tween()
	tween.tween_property(trail, "modulate:a", 0.0, TRAIL_FADE_TIME)
	tween.tween_callback(queue_free)


func _spawn_spark(pos: Vector2, normal: Vector2) -> void:
	var layer := get_tree().get_first_node_in_group("effects_layer")
	if layer == null:
		return
	var spark: Node2D = preload("res://scenes/effects/bounce_spark.tscn").instantiate()
	layer.add_child(spark)
	spark.global_position = pos
	spark.rotation = normal.angle()
	spark.play_burst()


func _draw() -> void:
	if not _expired:
		draw_circle(Vector2.ZERO, RADIUS, COLOR)
