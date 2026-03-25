class_name Center_Pile extends Pile
var cards = []
var rules: Array[Callable] = []

func get_card(index: int):
	return cards[index]
	
func add_card(card) -> void:
	card.z_index = cards.size()
	cards.append(card)

func pop() -> Card:
	return cards.pop_back()

func is_sandwich() -> bool:
	if cards.size() <= 2:
		return false
	return cards[-1].rank == cards[-3].rank
	
func is_pair() -> bool:
	if cards.size() <= 1:
		return false
	return cards[-1].rank == cards[-2].rank

# start with sandwich & pair
func is_valid_slap() -> bool:
	for rule in rules:
		if rule.call():
			return true
	return false
	
func _add_two() -> void:
	var new_card = load("res://Assets/Scenes/GameObjects/card.tscn").instantiate()
	new_card.setup(Card.Suit.SPADES, Card.Rank.TWO)
	add_card(new_card)
	add_child(new_card)
	
func _ready() -> void:
	# this can be where we change what rules are added to the checklist depending
	# on player customization.
	rules.append(is_sandwich)
	rules.append(is_pair)	


func _on_two_button_pressed() -> void:
	_add_two()
