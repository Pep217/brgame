extends StaticBody2D

## Axis-aligned (optionally rotated) wall segment. RoomBuilder instantiates
## this scene, adds it to the tree, then calls setup() with the JSON-defined
## size/position/rotation.

const FILL_COLOR := Color(0.11, 0.13, 0.22)
const BORDER_COLOR := Color(0.22, 0.9, 1.0)
const BORDER_WIDTH := 3.0

@onready var collision_shape: CollisionShape2D = $CollisionShape2D

var wall_size: Vector2 = Vector2(100, 20)


func setup(size: Vector2, world_position: Vector2, rot_deg: float) -> void:
	wall_size = size
	position = world_position
	rotation_degrees = rot_deg
	var shape := RectangleShape2D.new()
	shape.size = wall_size
	collision_shape.shape = shape
	queue_redraw()


func _draw() -> void:
	var half := wall_size * 0.5
	var rect := Rect2(-half, wall_size)
	draw_rect(rect, FILL_COLOR, true)
	draw_rect(rect, BORDER_COLOR, false, BORDER_WIDTH)
