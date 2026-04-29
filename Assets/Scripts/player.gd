class_name Player extends Pile

# Define variables
var player_username : String = "Player"
const OFFSET = Vector2(0.1, -0.5) # slight diagonal pile look

# Define references
@export var card_tscn: PackedScene

## When true, hand is driven by the server snapshot (no local drag-to-play).
var network_sync_hand: bool = false


func _process(_delta):
	# Animation for card dragging
	if dragged_card and Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
		dragged_card.global_position = get_global_mouse_position() + card_offset


# Deck creation
func add_card(card : Card) -> void:
	$Cards.add_child(card)

func set_card_positions() -> void:
	# this sets depth and creates the "stacking" look.
	for i in range($Cards.get_child_count()):
		$Cards.get_child(i).position = i * OFFSET

# Deck animation
var dragged_card = null
var card_offset = Vector2.ZERO
var original_position = Vector2.ZERO
var original_zindex = 0
var current_drop_zone = null # Tracks if over a valid zone

func _on_mouse_entered_deck() -> void:
	# Only show playable on current user's deck
	if player_username == Globals.username:
		Input.set_default_cursor_shape(Input.CURSOR_POINTING_HAND)

func _on_mouse_exited_deck() -> void:
	Input.set_default_cursor_shape(Input.CURSOR_ARROW)

func _start_card_drag(_viewport, event, _shape_idx):
	if network_sync_hand:
		return
	# Only allow if current user pile
	if player_username != Globals.username:
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
				card_offset = dragged_card.global_position - get_global_mouse_position()
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
		var central_deck = current_drop_zone.get_parent()
		
		# Move card to central deck position
		dragged_card.global_position = current_drop_zone.global_position
		
		# Remove card from player hand and add to central deck
		dragged_card.get_parent().remove_child(dragged_card)
		central_deck.add_card(dragged_card)
		
		# Remove connections
		dragged_card.area_entered.disconnect(_on_card_entered_area)
		dragged_card.area_entered.disconnect(_on_card_exited_area)
	else:
		# Return to the starting spot in the deck
		dragged_card.global_position = original_position
		dragged_card.z_index = original_zindex
	
	# Clear the references
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
