extends Control

@onready var continue_button: Button = $Root/VBoxContainer/ContinueButton
@onready var new_campaign_button: Button = $Root/VBoxContainer/NewCampaignButton
@onready var endless_button: Button = $Root/VBoxContainer/EndlessButton
@onready var quit_button: Button = $Root/VBoxContainer/QuitButton
@onready var stats_label: Label = $Root/StatsLabel


func _ready() -> void:
	Engine.time_scale = 1.0
	SteamManager.init()

	var unlocked := SaveData.get_unlocked_level_index()
	var total_levels: int = GameManager.level_manifest.size()

	if unlocked > 0 and unlocked < total_levels:
		continue_button.text = "Continue Campaign (Level %d)" % (unlocked + 1)
		continue_button.visible = true
	elif total_levels > 0 and unlocked >= total_levels:
		continue_button.text = "Replay Campaign"
		continue_button.visible = true
	else:
		continue_button.visible = false

	new_campaign_button.text = "New Campaign" if unlocked > 0 else "Start Campaign"

	continue_button.pressed.connect(func(): GameManager.continue_campaign())
	new_campaign_button.pressed.connect(func(): GameManager.start_campaign())
	endless_button.pressed.connect(func(): GameManager.start_endless())
	quit_button.pressed.connect(func(): get_tree().quit())

	stats_label.text = "Total Score: %d      Endless Best Streak: %d      Endless Best Score: %d" % [
		int(SaveData.data.get("total_score", 0)),
		SaveData.get_endless_best_streak(),
		SaveData.get_endless_best_score(),
	]
