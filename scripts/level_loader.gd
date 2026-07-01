class_name LevelLoader
extends RefCounted

## Loads a hand-authored JSON level file into the normalized in-memory shape
## shared with RoomGenerator's procedural output, so RoomBuilder never has to
## care where a room came from. See docs/LEVEL_FORMAT.md for the JSON schema.

static func load_from_file(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		push_error("LevelLoader: file not found: %s" % path)
		return {}
	var text := FileAccess.get_file_as_string(path)
	return load_from_text(text)


static func load_from_text(text: String) -> Dictionary:
	var parsed: Variant = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("LevelLoader: invalid JSON")
		return {}
	return normalize(parsed)


static func normalize(raw: Dictionary) -> Dictionary:
	var walls: Array = []
	for w in raw.get("walls", []):
		walls.append({
			"pos": Vector2(w["x"], w["y"]),
			"size": Vector2(w["w"], w["h"]),
			"rot": float(w.get("rot", 0.0)),
		})

	var enemies: Array = []
	for e in raw.get("enemies", []):
		enemies.append(Vector2(e["x"], e["y"]))

	var bounds_raw: Dictionary = raw.get("bounds", {"x": 0, "y": 0, "w": 960, "h": 540})
	var fire_origin_raw: Dictionary = raw.get("fire_origin", {"x": 480, "y": 480})

	return {
		"id": raw.get("id", "level"),
		"name": raw.get("name", "Untitled"),
		"bounds": {
			"x": float(bounds_raw.get("x", 0)),
			"y": float(bounds_raw.get("y", 0)),
			"w": float(bounds_raw.get("w", 960)),
			"h": float(bounds_raw.get("h", 540)),
		},
		"fire_origin": Vector2(fire_origin_raw.get("x", 480), fire_origin_raw.get("y", 480)),
		"par_bounces": int(raw.get("par_bounces", 3)),
		"par_time": float(raw.get("par_time", 3.0)),
		"walls": walls,
		"enemies": enemies,
	}
