extends Node2D

var selected_player: Player = null
var selected_card: Card = null
var is_dragging: bool = false
var queue_click: bool = false

@onready var center_pile = get_node("Center Pile")

func _input(event: InputEvent):
	# i hate chaining if's >:(
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
			if event.pressed:				
				# the reason for delegating queue_click to _physics_process is because there is thread-unsafe code.
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
			player_clicked(target)
		if target is Center_Pile:
			center_clicked()
				
	if is_dragging and selected_card:
		selected_card.global_position = get_global_mouse_position()
		
func reset_selection() -> void:
	selected_player = null
	selected_card = null
	
func player_clicked(player: Player) -> void:
	selected_player = player
	selected_card = player.get_top_card() 
	is_dragging = true
	
func center_clicked():
	print("Slap: ", center_pile.is_valid_slap())

# TODO: Create a larger radius around the center pile to allow for valid selection.
func is_valid_drop(target: Pile) -> bool:
	if target == center_pile:
		return true
	return false
	
func drop_card() -> void:
	if selected_card and selected_player:
		var target = get_under_mouse()
		if is_valid_drop(target):
			selected_player.pop()
			target.add_card(selected_card)
			selected_card.global_position = get_global_mouse_position()
		else:
			# return to original position
			selected_card.position = selected_player.get_top_position()
			
	reset_selection()
	
# get_world_2d is thread-unsafe, this func should only be called in _physics_process
func get_under_mouse() -> Node:
	# contains the low-level collision and physics information.
	var space_state = get_world_2d().direct_space_state
	
	var query = PhysicsPointQueryParameters2D.new()
	query.position = get_global_mouse_position()
	query.collide_with_areas = true
	query.collide_with_bodies = false
	
	var results: Array[Dictionary] = space_state.intersect_point(query)
	if results.size() > 0:
		var area = results[0]["collider"]
		return area.get_parent()
	return null
