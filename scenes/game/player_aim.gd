extends Node2D

## Mouse-driven aiming. Draws only a short direction reticle (never a
## predicted ricochet path) so figuring out the bounce is on the player, not
## the UI. Fires once per room via the "fire" input action.

signal fire_requested(direction: Vector2)

const AIM_LINE_LENGTH := 70.0
const AIM_LINE_COLOR := Color(1, 1, 1, 0.55)
const RETICLE_RADIUS := 5.0

var enabled := false:
	set(value):
		enabled = value
		queue_redraw()

var fire_origin: Vector2 = Vector2.ZERO


func _process(_delta: float) -> void:
	if enabled:
		queue_redraw()


func _unhandled_input(event: InputEvent) -> void:
	if not enabled:
		return
	if event.is_action_pressed("fire"):
		var dir := _aim_direction()
		if dir.length() > 0.001:
			fire_requested.emit(dir.normalized())


func _aim_direction() -> Vector2:
	return get_global_mouse_position() - fire_origin


func _draw() -> void:
	if not enabled:
		return
	var dir := _aim_direction()
	if dir.length() < 0.001:
		return
	dir = dir.normalized()
	var local_origin := to_local(fire_origin)
	draw_line(local_origin, local_origin + dir * AIM_LINE_LENGTH, AIM_LINE_COLOR, 2.0)
	draw_circle(local_origin, RETICLE_RADIUS, Color(1, 1, 1, 0.8))
