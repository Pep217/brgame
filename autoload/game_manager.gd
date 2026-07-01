extends Node

## Top-level game flow: which mode we're in, which level is active, and the
## bridge between the JSON level files / procedural generator and the actual
## Game scene. Kept deliberately dumb — Game.gd owns all real-time gameplay
## state, this just remembers "where are we" across scene changes.

enum Mode { CAMPAIGN, ENDLESS }

const MANIFEST_PATH := "res://data/levels/level_manifest.json"
const GAME_SCENE := "res://scenes/game/game.tscn"
const MAIN_MENU_SCENE := "res://scenes/main_menu/main_menu.tscn"

var mode: Mode = Mode.CAMPAIGN
var level_manifest: Array = []
var current_level_index: int = 0

var endless_difficulty: int = 0
var endless_streak: int = 0


func _ready() -> void:
	_load_manifest()


func _load_manifest() -> void:
	if not FileAccess.file_exists(MANIFEST_PATH):
		push_error("GameManager: manifest missing at %s" % MANIFEST_PATH)
		return
	var text := FileAccess.get_file_as_string(MANIFEST_PATH)
	var parsed: Variant = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY or not parsed.has("levels"):
		push_error("GameManager: malformed manifest")
		return
	level_manifest = parsed["levels"]


func start_campaign() -> void:
	mode = Mode.CAMPAIGN
	current_level_index = 0
	_goto_game_scene()


func continue_campaign() -> void:
	mode = Mode.CAMPAIGN
	current_level_index = clampi(SaveData.get_unlocked_level_index(), 0, maxi(level_manifest.size() - 1, 0))
	_goto_game_scene()


func start_endless() -> void:
	mode = Mode.ENDLESS
	endless_difficulty = 0
	endless_streak = 0
	_goto_game_scene()


func retry_current_level() -> void:
	_goto_game_scene()


func _goto_game_scene() -> void:
	get_tree().change_scene_to_file(GAME_SCENE)


func goto_main_menu() -> void:
	get_tree().change_scene_to_file(MAIN_MENU_SCENE)


func is_campaign_complete() -> bool:
	return mode == Mode.CAMPAIGN and current_level_index >= level_manifest.size()


func current_level_id() -> String:
	if mode == Mode.CAMPAIGN and current_level_index < level_manifest.size():
		return String(level_manifest[current_level_index])
	return "endless_%d" % endless_difficulty


func get_current_level_data() -> Dictionary:
	if mode == Mode.CAMPAIGN:
		if current_level_index >= level_manifest.size():
			return {}
		return LevelLoader.load_from_file(String(level_manifest[current_level_index]))
	else:
		return RoomGenerator.generate(endless_difficulty)


func advance_after_win(score_result: Dictionary) -> void:
	if int(score_result.get("bounce_bonus", 0)) >= ScoreCalc.MAX_BOUNCE_BONUS:
		SteamManager.unlock_achievement("direct_hit_no_bounce")
	if String(score_result.get("grade", "")) == "S":
		SteamManager.unlock_achievement("s_rank_clear")

	if mode == Mode.CAMPAIGN:
		if current_level_index == 0:
			SteamManager.unlock_achievement("first_blood")
		SaveData.record_level_result(current_level_index, current_level_id(), score_result)
		current_level_index += 1
		if current_level_index >= level_manifest.size():
			SteamManager.unlock_achievement("campaign_complete")
	else:
		endless_streak += 1
		endless_difficulty += 1
		SaveData.record_endless_result(endless_streak, score_result.get("total", 0))
		if endless_streak in [5, 10, 25]:
			SteamManager.unlock_achievement("endless_streak_%d" % endless_streak)
