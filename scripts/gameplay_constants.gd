class_name GameplayConstants
extends RefCounted

## Single source of truth for numbers shared between the real physics bullet
## (scenes/entities/bullet.gd) and the pure-math solver used for procedural
## generation and level validation. SOLVER_KILL_RADIUS is intentionally
## smaller than the real combined hitbox radius (KILL_RADIUS) so that any
## angle the solver validates as "solvable" is comfortably achievable by the
## actual in-game physics, never right on the edge of a miss.

const BULLET_SPEED := 900.0
const BULLET_RADIUS := 7.0
const ENEMY_RADIUS := 16.0

const MAX_BOUNCES := 12
const MAX_LIFETIME := 6.0 # seconds of in-room simulated time before the shot expires
const MAX_TRAVEL_DISTANCE := 6000.0

const SLOWMO_SCALE := 0.16
const SLOWMO_RECOVER_SECONDS := 0.5 # real (unscaled) seconds to ramp back to 1.0

const KILL_RADIUS := BULLET_RADIUS + ENEMY_RADIUS
const SOLVER_KILL_RADIUS := KILL_RADIUS - 4.0
const SOLVER_ANGLE_SAMPLES := 1440
const SOLVER_MAX_DISTANCE := 5000.0
