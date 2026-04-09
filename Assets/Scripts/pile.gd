class_name Pile extends Node2D

@export var card_tscn: PackedScene

# unused; probably used later for networking or something
var pile_id = 1

const OFFSET = Vector2(0.05, -0.5) # slight diagonal pile look

func shuffle() -> void:
	# kind of fisher-yates shufffle
	var n = $Cards.get_child_count()
	for i in range(n - 1, 0, -1):
		var j = randi() % (i + 1)
		$Cards.move_child($Cards.get_child(i), j)
		
func set_card_positions() -> void:
	# this sets depth and creates the "stacking" look.
	for i in range($Cards.get_child_count()):
		$Cards.get_child(i).position = i * OFFSET
		
func get_top_position():
	return ($Cards.get_child_count() - 1) * OFFSET
		
func give_all_cards():
	for suit in Card.Suit.values():
		for rank in Card.Rank.values():
			var new_card = card_tscn.instantiate()
			new_card.setup(suit, rank)
			$Cards.add_child(new_card)


func get_top_card() -> Card:
	return $Cards.get_child(-1)
	
func add_card(card : Card) -> void:
	$Cards.add_child(card)
	
func pop() -> Card:
	var card = $Cards.get_child(-1)
	$Cards.remove_child(card)
	return card
	
func is_empty() -> bool:
	return $Cards.get_child_count() == 0
