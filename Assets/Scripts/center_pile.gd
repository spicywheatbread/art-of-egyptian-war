extends Pile
var cards = []

func add_card(card) -> void:
	card.z_index = cards.size()
	cards.append(card)

func pop() -> Card:
	return cards.pop_back()
