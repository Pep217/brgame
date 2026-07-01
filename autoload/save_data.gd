extends Node

## Local persistence for campaign progress, per-level grades and endless-mode
## high scores. Saved as plain JSON under user:// so it's easy to inspect
## while iterating.

const SAVE_PATH := "user://savegame.json"

var data: Dictionary = _default_data()


func _ready() -> void:
	load_data()


func _default_data() -> Dictionary:
	return {
		"unlocked_level_index": 0,
		"levels": {}, # level_id -> {"best_grade": String, "best_score": int}
		"endless_best_streak": 0,
		"endless_best_score": 0,
		"total_score": 0,
	}


func load_data() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		data = _default_data()
		return
	var text := FileAccess.get_file_as_string(SAVE_PATH)
	var parsed: Variant = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY:
		data = _default_data()
		return
	var loaded: Dictionary = parsed
	var merged := _default_data()
	for key in loaded.keys():
		merged[key] = loaded[key]
	data = merged


func save_data() -> void:
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file == null:
		push_warning("SaveData: could not open %s for writing" % SAVE_PATH)
		return
	file.store_string(JSON.stringify(data, "\t"))
	file.close()


func record_level_result(level_index: int, level_id: String, score_result: Dictionary) -> void:
	var levels: Dictionary = data["levels"]
	var previous: Dictionary = levels.get(level_id, {"best_grade": "-", "best_score": 0})
	var new_score: int = score_result.get("total", 0)
	if new_score > int(previous.get("best_score", 0)):
		previous["best_score"] = new_score
		previous["best_grade"] = score_result.get("grade", "-")
	levels[level_id] = previous
	data["levels"] = levels
	data["unlocked_level_index"] = maxi(int(data.get("unlocked_level_index", 0)), level_index + 1)
	data["total_score"] = int(data.get("total_score", 0)) + new_score
	save_data()


func record_endless_result(streak: int, score: int) -> void:
	data["endless_best_streak"] = maxi(int(data.get("endless_best_streak", 0)), streak)
	data["endless_best_score"] = maxi(int(data.get("endless_best_score", 0)), score)
	save_data()


func get_unlocked_level_index() -> int:
	return int(data.get("unlocked_level_index", 0))


func get_level_best(level_id: String) -> Dictionary:
	var levels: Dictionary = data.get("levels", {})
	return levels.get(level_id, {"best_grade": "-", "best_score": 0})


func get_endless_best_streak() -> int:
	return int(data.get("endless_best_streak", 0))


func get_endless_best_score() -> int:
	return int(data.get("endless_best_score", 0))
