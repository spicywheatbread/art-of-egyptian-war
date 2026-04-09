class_name Player extends Pile

func give_all_cards():
	for suit in Card.Suit.values():
		for rank in Card.Rank.values():
			var new_card = card_tscn.instantiate()
			new_card.setup(suit, rank)
			$Cards.add_child(new_card)

# Called when the node enters the scene tree for the first time.
func _ready() -> void:
	give_all_cards() # temporary, haven't made card dealing yet
	shuffle()
	set_card_positions()
