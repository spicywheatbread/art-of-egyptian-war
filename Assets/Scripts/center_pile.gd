class_name Center_Pile extends Pile

# Define variables
var cards = []
var rules: Array[Callable] = []
const OFFSET = Vector2(0.05, -0.5) # slight diagonal pile look

# Define references
@export var card_tscn: PackedScene

func get_card(index: int):
	return cards[index]
	
func add_card(card) -> void:
	add_child(card)
	cards.append(card)
	card.z_index = cards.size()
	card.position = Vector2.ZERO + cards.size() * OFFSET

## Clears authoritative stack (used when syncing from server).
func clear_pile() -> void:
	cards.clear()
	for child in get_children():
		if child is Card:
			child.queue_free()

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
	
