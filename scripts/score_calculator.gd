class_name ScoreCalc
extends RefCounted

## Hotline-Miami-style scoring: reward killing everyone with the fewest
## bounces and the fastest aim, then convert into a letter grade.

const BASE_PER_ENEMY := 500
const MAX_BOUNCE_BONUS := 1000
const MAX_TIME_BONUS := 500
const TIME_BONUS_WINDOW := 4.0 # seconds of aim time after which the bonus is 0


static func compute(enemies_killed: int, bounce_count: int, par_bounces: int, aim_time: float) -> Dictionary:
	var base_score := enemies_killed * BASE_PER_ENEMY
	var bounce_ratio: float = clampf(1.0 - float(bounce_count) / float(maxi(par_bounces, 1)), 0.0, 1.0)
	var bounce_bonus := int(roundf(MAX_BOUNCE_BONUS * bounce_ratio))
	var time_ratio: float = clampf(1.0 - aim_time / TIME_BONUS_WINDOW, 0.0, 1.0)
	var time_bonus := int(roundf(MAX_TIME_BONUS * time_ratio))
	var total := base_score + bounce_bonus + time_bonus
	return {
		"base": base_score,
		"bounce_bonus": bounce_bonus,
		"time_bonus": time_bonus,
		"total": total,
		"grade": grade_for(total, enemies_killed),
	}


static func grade_for(total: int, enemies_killed: int) -> String:
	if enemies_killed <= 0:
		return "-"
	var max_possible := enemies_killed * BASE_PER_ENEMY + MAX_BOUNCE_BONUS + MAX_TIME_BONUS
	var ratio := float(total) / float(max_possible)
	if ratio >= 0.95:
		return "S"
	elif ratio >= 0.8:
		return "A"
	elif ratio >= 0.6:
		return "B"
	elif ratio >= 0.4:
		return "C"
	else:
		return "D"
