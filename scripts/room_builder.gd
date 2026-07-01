class_name RoomBuilder
extends Node2D

## Builds the current room's walls and enemies from normalized level data
## (see LevelLoader / RoomGenerator) and tracks how many enemies are still
## alive so Game.gd and the bullet know when the room is cleared.

signal cleared

const WALL_SCENE := preload("res://scenes/entities/wall.tscn")
const ENEMY_SCENE := preload("res://scenes/entities/enemy.tscn")

var enemies: Array = []
var fire_origin: Vector2 = Vector2.ZERO
var bounds: Dictionary = {}
var par_bounces: int = 3
var par_time: float = 3.0


func build(level_data: Dictionary) -> void:
	clear_room()
	bounds = level_data.get("bounds", {"x": 0, "y": 0, "w": 960, "h": 540})
	fire_origin = level_data.get("fire_origin", Vector2(480, 480))
	par_bounces = int(level_data.get("par_bounces", 3))
	par_time = float(level_data.get("par_time", 3.0))

	for w in level_data.get("walls", []):
		var wall := WALL_SCENE.instantiate()
		add_child(wall)
		wall.setup(w["size"], w["pos"], float(w.get("rot", 0.0)))

	enemies.clear()
	for pos in level_data.get("enemies", []):
		var enemy := ENEMY_SCENE.instantiate()
		add_child(enemy)
		enemy.position = pos
		enemy.died.connect(_on_enemy_died)
		enemies.append(enemy)


func clear_room() -> void:
	for child in get_children():
		child.queue_free()
	enemies.clear()


func enemies_remaining() -> int:
	var count := 0
	for e in enemies:
		if is_instance_valid(e) and not e.is_dead():
			count += 1
	return count


func total_enemy_count() -> int:
	return enemies.size()


func _on_enemy_died() -> void:
	if enemies_remaining() == 0:
		cleared.emit()
