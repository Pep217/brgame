extends CanvasLayer

@onready var level_label: Label = $Root/LevelLabel
@onready var bounce_label: Label = $Root/BounceLabel
@onready var result_panel: Panel = $Root/ResultPanel
@onready var result_title: Label = $Root/ResultPanel/VBoxContainer/ResultTitle
@onready var result_detail: Label = $Root/ResultPanel/VBoxContainer/ResultDetail
@onready var continue_prompt: Label = $Root/ResultPanel/VBoxContainer/ContinuePrompt
@onready var campaign_complete_panel: Panel = $Root/CampaignCompletePanel


func _ready() -> void:
	result_panel.visible = false
	bounce_label.visible = false
	campaign_complete_panel.visible = false


func reset_for_new_room(level_name: String, enemy_count: int) -> void:
	result_panel.visible = false
	campaign_complete_panel.visible = false
	bounce_label.visible = false
	bounce_label.text = "Bounces: 0"
	var target_word := "target" if enemy_count == 1 else "targets"
	level_label.text = "%s   (%d %s)" % [level_name, enemy_count, target_word]


func show_bounce_counter(is_visible: bool) -> void:
	bounce_label.visible = is_visible


func update_bounces(count: int) -> void:
	bounce_label.text = "Bounces: %d" % count


func show_result(win: bool, score_result: Dictionary, aim_time: float) -> void:
	result_panel.visible = true
	if win:
		var grade: String = score_result.get("grade", "-")
		result_title.text = "CLEARED — %s" % grade
		result_title.modulate = Color(0.4, 1.0, 0.6)
		result_detail.text = "Base %d   Bounce Bonus %d   Speed Bonus %d\nTotal %d   Aim Time %.2fs" % [
			int(score_result.get("base", 0)),
			int(score_result.get("bounce_bonus", 0)),
			int(score_result.get("time_bonus", 0)),
			int(score_result.get("total", 0)),
			aim_time,
		]
		continue_prompt.text = "Click / Space to continue"
	else:
		result_title.text = "MISSED"
		result_title.modulate = Color(1.0, 0.35, 0.4)
		result_detail.text = "Not everyone went down. Try again."
		continue_prompt.text = "Click / Space / R to retry"


func show_campaign_complete() -> void:
	campaign_complete_panel.visible = true
