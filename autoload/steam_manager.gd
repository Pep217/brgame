extends Node

## Stub integration point for GodotSteam (https://godotsteam.com/).
## This project does not bundle the GodotSteam GDExtension binaries, so
## ENABLED stays false and every call safely no-ops and logs instead.
## See docs/STEAM_INTEGRATION.md for the exact steps to wire up the real
## Steamworks SDK (achievements, leaderboards, rich presence) later.

const ENABLED := false

signal achievement_unlocked(achievement_id: String)

var _unlocked: Dictionary = {}


func init() -> void:
	if ENABLED:
		pass # Steam.steamInit() would go here.
	else:
		print("[SteamManager] running in stub mode (no GodotSteam present)")


func unlock_achievement(achievement_id: String) -> void:
	if _unlocked.get(achievement_id, false):
		return
	_unlocked[achievement_id] = true
	if ENABLED:
		pass # Steam.setAchievement(achievement_id); Steam.storeStats()
	else:
		print("[SteamManager] (stub) achievement unlocked: %s" % achievement_id)
	achievement_unlocked.emit(achievement_id)


func submit_score(leaderboard_name: String, score: int) -> void:
	if ENABLED:
		pass # Steam leaderboard upload would go here.
	else:
		print("[SteamManager] (stub) leaderboard '%s' score: %d" % [leaderboard_name, score])
