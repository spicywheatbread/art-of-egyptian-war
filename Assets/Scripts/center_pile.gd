class_name Center_Pile extends Pile

var cards = []
var rules: Array[Callable] = []

func is_sandwich() -> bool:
	return $Cards.get_child_count() >= 3 and $Cards.get_child(-1).rank == $Cards.get_child(-3).rank
	
func is_pair() -> bool:
	return $Cards.get_child_count() >= 2 and $Cards.get_child(-1).rank == $Cards.get_child(-2).rank

func is_valid_slap() -> bool:
	for rule in rules:
		if rule.call():
			return true
	return false

func _ready() -> void:
	# this can be where we change what rules are added to the checklist depending
	# on player customization.
	rules.append(is_sandwich)
	rules.append(is_pair)	

func _on_two_button_pressed() -> void:
	_add_two()
	
# for debugging slap rules
func _add_two() -> void:
	var new_card = card_tscn.instantiate()
	new_card.setup(Card.Suit.SPADES, Card.Rank.TWO)
	add_card(new_card)
	add_child(new_card)
	
