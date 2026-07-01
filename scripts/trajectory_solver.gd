class_name TrajectorySolver
extends RefCounted

## Pure-math ricochet simulation used both by the procedural room generator
## (to guarantee every generated room has a valid one-shot solution) and by
## the offline level validators (tests/level_autotest.gd, tests/physics_autotest.tscn)
## that check every hand-authored JSON level before it ships.
##
## Walls are axis-aligned-in-local-space oriented boxes:
## { "pos": Vector2, "size": Vector2, "rot": float (degrees) }
##
## A real bullet has physical size, so wall boxes are inflated by
## `bullet_radius` (a Minkowski-sum approximation of sweeping a circle along
## the ray) to match. That approximation uses SHARP corners, while Godot's
## real circle-vs-box physics rounds them — the two models disagree in the
## small zone right at a corner. Rather than modeling true rounded corners,
## hits landing in that zone are flagged "corner_ambiguous" and
## find_best_angle prefers solutions that never rely on one, since those are
## the only ones guaranteed to play out identically in the real physics
## engine (see tests/physics_autotest.tscn, which verifies this).

const EPS := 0.0001

## Ray vs oriented box, inflated by `inflate` on every side. Returns {} if no
## forward hit, otherwise {"point": Vector2, "normal": Vector2,
## "distance": float, "corner_ambiguous": bool}.
static func ray_vs_wall(origin: Vector2, dir: Vector2, wall: Dictionary, inflate: float = 0.0) -> Dictionary:
	var center: Vector2 = wall["pos"]
	var half: Vector2 = wall["size"] * 0.5 + Vector2(inflate, inflate)
	var rot: float = deg_to_rad(wall.get("rot", 0.0))
	var local_origin: Vector2 = (origin - center).rotated(-rot)
	var local_dir: Vector2 = dir.rotated(-rot)

	var tmin := -INF
	var tmax := INF
	var hit_axis := -1
	var hit_sign := 1.0

	for axis in range(2):
		var o: float = local_origin.x if axis == 0 else local_origin.y
		var d: float = local_dir.x if axis == 0 else local_dir.y
		var h: float = half.x if axis == 0 else half.y
		if absf(d) < EPS:
			if o < -h or o > h:
				return {}
		else:
			var t1 := (-h - o) / d
			var t2 := (h - o) / d
			var sign1 := -1.0
			var sign2 := 1.0
			if t1 > t2:
				var tmp := t1
				t1 = t2
				t2 = tmp
				var stmp := sign1
				sign1 = sign2
				sign2 = stmp
			if t1 > tmin:
				tmin = t1
				hit_axis = axis
				hit_sign = sign1
			tmax = minf(tmax, t2)
			if tmin > tmax:
				return {}

	if tmax < EPS or tmin <= EPS:
		return {}

	var hit_local: Vector2 = local_origin + local_dir * tmin
	var normal_local: Vector2 = Vector2(hit_sign, 0.0) if hit_axis == 0 else Vector2(0.0, hit_sign)
	var normal_world: Vector2 = normal_local.rotated(rot)
	var point_world: Vector2 = center + hit_local.rotated(rot)

	var other_axis := 1 - hit_axis
	var other_val: float = hit_local.y if hit_axis == 0 else hit_local.x
	var other_half: float = half.y if hit_axis == 0 else half.x
	var corner_margin: float = maxf(inflate, 1.0)
	var corner_ambiguous: bool = (other_half - absf(other_val)) < corner_margin

	return {
		"point": point_world,
		"normal": normal_world,
		"distance": tmin,
		"corner_ambiguous": corner_ambiguous,
	}


static func nearest_wall_hit(origin: Vector2, dir: Vector2, walls: Array, inflate: float = 0.0) -> Dictionary:
	var best := {}
	var best_dist := INF
	for wall in walls:
		var hit := ray_vs_wall(origin, dir, wall, inflate)
		if hit.is_empty():
			continue
		if hit["distance"] < best_dist:
			best_dist = hit["distance"]
			best = hit
	return best


## Simulates the bullet's full ricochet path. Stops after max_bounces
## reflections (matching Bullet.gd, which expires the instant bounce_count
## reaches MAX_BOUNCES rather than after one more) or once max_distance total
## travel is reached. `bullet_radius` inflates the walls so the simulated
## path matches a real, physically-sized bullet rather than an idealized
## point. Returns {"path": Array[Vector2], "corner_safe": bool} — corner_safe
## is false if any bounce landed in the corner-rounding ambiguity zone (see
## class doc).
static func simulate_path(origin: Vector2, dir: Vector2, walls: Array, max_bounces: int, max_distance: float, bullet_radius: float = 0.0) -> Dictionary:
	var points: Array = [origin]
	var pos := origin
	var d := dir.normalized()
	var traveled := 0.0
	var bounces := 0
	var corner_safe := true

	while bounces < max_bounces and traveled < max_distance:
		var hit := nearest_wall_hit(pos, d, walls, bullet_radius)
		if hit.is_empty():
			points.append(pos + d * (max_distance - traveled))
			break
		var seg_len: float = pos.distance_to(hit["point"])
		if traveled + seg_len > max_distance:
			points.append(pos + d * (max_distance - traveled))
			break
		if hit["corner_ambiguous"]:
			corner_safe = false
		points.append(hit["point"])
		traveled += seg_len
		pos = hit["point"]
		d = d.bounce(hit["normal"])
		bounces += 1

	return {"path": points, "corner_safe": corner_safe}


static func point_segment_distance(p: Vector2, a: Vector2, b: Vector2) -> float:
	var ab := b - a
	var len_sq := ab.length_squared()
	if len_sq < EPS:
		return p.distance_to(a)
	var t: float = clampf((p - a).dot(ab) / len_sq, 0.0, 1.0)
	var proj := a + ab * t
	return p.distance_to(proj)


## Returns a bool array in the same order as `enemies`, true where the given
## polyline `path` passes within `kill_radius` of that enemy.
static func covered_enemies(path: Array, enemies: Array, kill_radius: float) -> Array:
	var covered: Array = []
	for e in enemies:
		var hit := false
		for i in range(path.size() - 1):
			if point_segment_distance(e, path[i], path[i + 1]) <= kill_radius:
				hit = true
				break
		covered.append(hit)
	return covered


## Scans `angle_samples` directions from `origin` and returns the best result
## found: {"angle": float radians, "covered_count": int, "covered": Array[bool],
## "path": Array[Vector2], "full_clear": bool, "corner_safe": bool}.
## A result is only trustworthy in the real physics engine when both
## full_clear and corner_safe are true — see class doc.
static func find_best_angle(origin: Vector2, walls: Array, enemies: Array, kill_radius: float, max_bounces: int, max_distance: float, angle_samples: int, bullet_radius: float = 0.0) -> Dictionary:
	var best := {"angle": 0.0, "covered_count": -1, "covered": [], "path": [], "full_clear": false, "corner_safe": false}
	if enemies.is_empty():
		return best
	for i in range(angle_samples):
		var angle: float = TAU * float(i) / float(angle_samples)
		var dir := Vector2.RIGHT.rotated(angle)
		var sim := simulate_path(origin, dir, walls, max_bounces, max_distance, bullet_radius)
		var path: Array = sim["path"]
		var corner_safe: bool = sim["corner_safe"]
		var covered := covered_enemies(path, enemies, kill_radius)
		var count := 0
		for c in covered:
			if c:
				count += 1
		var full_clear: bool = count == enemies.size()
		if full_clear and corner_safe:
			return {
				"angle": angle,
				"covered_count": count,
				"covered": covered,
				"path": path,
				"full_clear": true,
				"corner_safe": true,
			}
		if count > best["covered_count"]:
			best = {
				"angle": angle,
				"covered_count": count,
				"covered": covered,
				"path": path,
				"full_clear": full_clear,
				"corner_safe": corner_safe,
			}
	return best
