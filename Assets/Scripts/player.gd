class_name Player extends Pile

@export var card_tscn: PackedScene
var player_username : String = "uninitialized"
var cards = []

#const OFFSET = Vector2(0, -0.5) # vertical pile look
const OFFSET = Vector2(0.05, -0.5) # slight diagonal pile look

func get_top_card() -> Card:
	return $Cards.get_child(-1)
	
func add_card(card : Card) -> void:
	$Cards.add_child(card)
	
func pop() -> Card:
	var card = $Cards.get_child(-1)
	$Cards.remove_child(card)
	return card
		
func set_card_positions() -> void:
	# this sets depth and creates the "stacking" look.
	for i in range($Cards.get_child_count()):
		$Cards.get_child(i).position = i * OFFSET
		
func get_top_position():
	return ($Cards.get_child_count() - 1) * OFFSET
