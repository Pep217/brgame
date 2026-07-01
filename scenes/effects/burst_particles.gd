extends CPUParticles2D

## Shared one-shot burst behaviour for both the enemy hit-burst and the wall
## bounce-spark effects. Named play_burst() (not restart()) so it doesn't
## shadow CPUParticles2D's own native restart() method.

func play_burst() -> void:
	emitting = false
	restart()
	emitting = true
	get_tree().create_timer(lifetime + 0.2).timeout.connect(queue_free)
