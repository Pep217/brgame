extends Node

## Dev-only: instance any scene, let it settle, save one screenshot. Used for
## the menu preview. Not shipped.

@export var scene_path: String = "res://scenes/main_menu/main_menu.tscn"
@export var out_path: String = "user://shots/menu.png"
@export var delay: float = 0.6


func _ready() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://shots"))
	var packed: PackedScene = load(scene_path)
	add_child(packed.instantiate())
	await get_tree().create_timer(delay).timeout
	await get_tree().process_frame
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	img.save_png(out_path)
	print("saved ", ProjectSettings.globalize_path(out_path))
	get_tree().quit()
