extends Node2D

var selected_player = null
var selected_card = null
var is_dragging = false
var queue_click = false

func _input(event):
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
			if event.pressed:
				queue_click = true
			else:
				if is_dragging:
					drop_card()
				is_dragging = false

func _physics_process(delta):
	if queue_click:
		queue_click = false

		var space_state = get_world_2d().direct_space_state
		var query = PhysicsPointQueryParameters2D.new()
		query.position = get_global_mouse_position()
		query.collide_with_areas = true
		query.collide_with_bodies = false

		var results = space_state.intersect_point(query)

		if results.size() > 0:
			var area = results[0]["collider"]
			var player = area.get_parent()
			if player.has_method("get_top_card"):
				select_card_from(player)

	if is_dragging and selected_card:
		selected_card.global_position = get_global_mouse_position()

# ------------------------
func select_card_from(player):
	selected_player = player
	selected_card = player.get_top_card() # You define this function
	is_dragging = true
	print("Picked card:", selected_card.card_name)

func drop_card():
	if selected_card and selected_player:
		var target_player = get_player_under_mouse()
		if target_player and target_player != selected_player:
			# Move card to new pile
			selected_player.remove_card(selected_card)
			target_player.add_card(selected_card)
			print("Dropped card on:", target_player.name)
		else:
			# Return to original pile
			selected_card.global_position = selected_player.get_card_position()

	selected_card = null
	selected_player = null
	
func get_player_under_mouse():
	var space_state = get_world_2d().direct_space_state
	var query = PhysicsPointQueryParameters2D.new()
	query.position = get_global_mouse_position()
	query.collide_with_areas = true
	query.collide_with_bodies = false
	var results = space_state.intersect_point(query)
	if results.size() > 0:
		var area = results[0]["collider"]
		return area.get_parent()
	return null
