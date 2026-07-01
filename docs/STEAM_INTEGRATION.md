# Steam integration (not yet wired up)

`autoload/steam_manager.gd` is a stub: `SteamManager.ENABLED = false`, so
every call just logs and no-ops. This project does not bundle the
GodotSteam GDExtension binaries. To actually ship on Steam:

1. Add [GodotSteam](https://godotsteam.com/) (the GDExtension build, not the
   module build, so no engine recompile is needed) to the project.
2. Drop a `steam_appid.txt` with your App ID next to the exported binary
   for local testing.
3. In `autoload/steam_manager.gd`:
   - Flip `ENABLED` to `true`.
   - In `init()`, call `Steam.steamInit()` and check the result.
   - In `unlock_achievement()`, call `Steam.setAchievement(achievement_id)`
     then `Steam.storeStats()`.
   - In `submit_score()`, call `Steam.findLeaderboard(leaderboard_name)`,
     wait for `leaderboard_find_result`, then
     `Steam.uploadLeaderboardScore(score)`.
4. Call `Steam.run_callbacks()` once per frame (e.g. from a `_process` in
   this same autoload) once `ENABLED` is true.

## Suggested achievement hooks

These are the natural moments to call `SteamManager.unlock_achievement()`
once real Steamworks calls are wired in — none of this logic exists yet,
these are just where the calls would go:

- First campaign level cleared.
- First `S` grade.
- Clearing a level with zero bounces (a direct-hit shot).
- Endless Mode streak milestones (5 / 10 / 25 rooms).
- Full campaign completion.

## Suggested leaderboards

- `total_score` — sum of every campaign level's best score
  (`SaveData.data.total_score`).
- `endless_best_score` / `endless_best_streak` — Endless Mode bests
  (`SaveData.get_endless_best_score()` / `get_endless_best_streak()`).

`Game.gd` and `GameManager.gd` don't need to change for any of this — they
already funnel every result through `SaveData`, so the Steam calls only need
to be added at the same points `SaveData.record_level_result()` /
`record_endless_result()` are already called from
`autoload/game_manager.gd`.
