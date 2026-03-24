extends Node2D

var selected_player: Pile = null
var selected_card: Card = null
var is_dragging: bool = false
var queue_click: bool = false

@onready var center_pile = get_node("Center Pile")

func _input(event: InputEvent):
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
			if event.pressed:
				queue_click = true
			else:
				if is_dragging:
					drop_card()
				is_dragging = false
				
func _physics_process(delta: float):
	if queue_click:
		queue_click = false

		var target = get_under_mouse()
		if target is Player:
			player_click(target)
				
	if is_dragging and selected_card:
		selected_card.global_position = get_global_mouse_position()
		
func reset_selection() -> void:
	selected_player = null
	selected_card = null
	
func player_click(player: Player) -> void:
	selected_player = player
	selected_card = player.get_top_card() 
	is_dragging = true
	
func valid_drop(target: Pile) -> bool:
	if target == center_pile:
		return true
	return false
	
func drop_card() -> void:
	if selected_card and selected_player:
		var target = get_under_mouse()
		if valid_drop(target):
			selected_player.pop()
			target.add_card(selected_card)
		else:
			# Return to original pile
			selected_card.global_position = selected_player.get_card_position()
		reset_selection()

	selected_card = null
	selected_player = null
	
func get_under_mouse() -> Node2D:
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
