class_name Player extends Pile

@export var card_tscn: PackedScene
var cards = []

#const OFFSET = Vector2(0, -0.5) # vertical pile look
const OFFSET = Vector2(0.05, -0.5) # slight diagonal pile look

func get_top_card() -> Card:
	return cards.back()
	
func add_card(card : Card) -> void:
	cards.append(card)
	
func pop() -> Card:
	return cards.pop_back()
	
func shuffle(deck: Array) -> void:
	# Fisher-Yates shuffle
	var n = deck.size()
	for i in range(n - 1, 0, -1):
		var j = randi() % (i + 1)  # pick a random index from 0 to i
		var temp = deck[i]
		deck[i] = deck[j]
		deck[j] = temp
		
func set_card_positions() -> void:
	# this sets depth and creates the "stacking" look.
	for i in range(cards.size()):
		cards[i].position = i * OFFSET
		cards[i].z_index = i
		
func get_top_position():
	return self.position + cards.size() * OFFSET
		
func give_all_cards():
	for suit in Card.Suit.values():
		for rank in Card.Rank.values():
			var new_card = card_tscn.instantiate()
			new_card.setup(suit, rank)
			cards.append(new_card)
			add_child(new_card)

# Called when the node enters the scene tree for the first time.
func _ready() -> void:
	give_all_cards() # temporary, haven't made card dealing yet
	shuffle(cards)
	set_card_positions()
