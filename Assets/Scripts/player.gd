class_name Player extends Pile

# Define variables
var player_username : String = "Player"
const OFFSET = Vector2(0.1, -0.5) # slight diagonal pile look

# Define references
@export var card_tscn: PackedScene

## When true, hand is driven by the server snapshot (no local drag-to-play).
var network_sync_hand: bool = false

func setup(username: String) -> void:
	set_player_username(username)
	visible = true
	process_mode = Node.PROCESS_MODE_ALWAYS
	
func _process(_delta):
	# Animation for card dragging
	if dragged_card and Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
		dragged_card.global_position = get_global_mouse_position()
		NetworkClient.drag_card(dragged_card.global_position)


# Deck creation
func add_card(card : Card) -> void:
	$Cards.add_child(card)

func set_card_positions() -> void:
	# this sets depth and creates the "stacking" look.
	for i in range($Cards.get_child_count()):
		$Cards.get_child(i).position = i * OFFSET

func display_dragged(pos: Vector2): 
	$Cards.get_child(-1).global_position = pos
	
# Deck animation
var dragged_card = null
var card_offset = Vector2.ZERO
var original_position = Vector2.ZERO
var original_zindex = 0
var current_drop_zone = null # Tracks if over a valid zone
@onready var main_game = get_node("/root/Game")

func is_my_turn() -> bool:
	return Globals.username == main_game.get_current_turn_username()
	
func _on_mouse_entered_deck() -> void:
	# Only show playable on current user's deck
	if player_username == Globals.username and is_my_turn():
		Input.set_default_cursor_shape(Input.CURSOR_POINTING_HAND)

func _on_mouse_exited_deck() -> void:
	Input.set_default_cursor_shape(Input.CURSOR_ARROW)

func _start_card_drag(_viewport, event, _shape_idx):
	if network_sync_hand:
		return
		
	# Only allow a player to drag their own pile
	if player_username != Globals.username:
		return
		
	if player_username != main_game.get_current_turn_username():
		return

	# Start drag on left button click
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			if $Cards.get_child_count() > 0:
				dragged_card = $Cards.get_child(-1)

				# Connect card collision to current script
				dragged_card.area_entered.connect(_on_card_entered_area)
				dragged_card.area_exited.connect(_on_card_exited_area)

				# Positioning
				original_position = dragged_card.global_position 
				original_zindex = dragged_card.z_index
				card_offset = dragged_card.global_position
				dragged_card.z_index = 100

func _on_card_entered_area(area):
	# Drop signal was added for Central Pile using "Groups"
	if area.is_in_group("drop_zones"):
		current_drop_zone = area

func _on_card_exited_area(area):
	if area == current_drop_zone:
		current_drop_zone = null

func _input(event):
	if network_sync_hand:
		return
	# Global input function to drop card on left click release
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if not event.pressed and dragged_card:
			_handle_drop()

func _handle_drop():	
	if current_drop_zone:
		NetworkClient.play_card(dragged_card.global_position)

	else:
		# Return to the starting spot in the deck
		dragged_card.global_position = original_position
		dragged_card.z_index = original_zindex
		NetworkClient.drag_card(dragged_card.global_position)
	
	# Clear the references
	dragged_card.area_entered.disconnect(_on_card_entered_area)
	dragged_card.area_exited.disconnect(_on_card_exited_area)
	dragged_card = null
	current_drop_zone = null


# Deck play
func get_top_card() -> Card:
	return $Cards.get_child(-1)

func pop() -> Card:
	var card = $Cards.get_child(-1)
	$Cards.remove_child(card)
	return card

func get_top_position():
	return ($Cards.get_child_count() - 1) * OFFSET

# Setter methods
func set_player_username(username : String) -> void:
	player_username = username
	$Label.text = username
	
func set_username_color_me():
	$Label.add_theme_color_override("font_color", Color(255, 208, 0, 255))
	
func set_label_turn(is_my_turn: bool):
	if is_my_turn:
		$Label.text = str("> ", player_username, " <")
	else:
		$Label.text = player_username

## Matches visible card backs to the server's hand_count for this seat.
func set_hand_card_count(count: int) -> void:
	count = clampi(count, 0, 52)
	while $Cards.get_child_count() < count:
		var new_card = card_tscn.instantiate()
		new_card.setup_blank()
		add_card(new_card)
	while $Cards.get_child_count() > count:
		var last = $Cards.get_child(-1)
		$Cards.remove_child(last)
		last.queue_free()
	set_card_positions()
