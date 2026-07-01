extends Area2D

## Static target. Dies the instant the bullet's hit-area overlaps it — the
## bullet itself is not stopped or slowed, so a single shot can chain through
## multiple enemies.

signal died

const RADIUS := 16.0
const FILL_COLOR := Color(1.0, 0.18, 0.42)
const RING_COLOR := Color(1.0, 0.6, 0.75)

@onready var collision_shape: CollisionShape2D = $CollisionShape2D

var _dead := false


func _ready() -> void:
	add_to_group("enemy")
	var shape := CircleShape2D.new()
	shape.radius = RADIUS
	collision_shape.shape = shape
	queue_redraw()


func _draw() -> void:
	draw_circle(Vector2.ZERO, RADIUS, FILL_COLOR)
	draw_arc(Vector2.ZERO, RADIUS - 2.0, 0.0, TAU, 24, RING_COLOR, 2.0)


func is_dead() -> bool:
	return _dead


func kill() -> void:
	if _dead:
		return
	_dead = true
	set_deferred("monitorable", false)
	_spawn_burst()
	died.emit()
	var tween := create_tween()
	tween.tween_property(self, "scale", Vector2.ZERO, 0.18).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_IN)
	tween.tween_callback(queue_free)


func _spawn_burst() -> void:
	var layer := get_tree().get_first_node_in_group("effects_layer")
	if layer == null:
		return
	var burst: Node2D = preload("res://scenes/effects/hit_burst.tscn").instantiate()
	layer.add_child(burst)
	burst.global_position = global_position
	burst.play_burst()
