extends Node2D
class_name Player 

var card_tscn : PackedScene = preload("res://Assets/Scenes/GameObjects/card.tscn")
var cards = []
var offset = Vector2(0, -0.5)

func get_top_card():
	return cards.back()
	
func pop_card() -> Card:
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
	for i in range(cards.size()):
		cards[i].position = i * offset
		
func get_card_position():
	return cards.size() * offset
		
func give_all_cards():
	for suit in Card.Suit.values():
		for rank in Card.Rank.values():
			var new_card = card_tscn.instantiate()
			new_card.setup(suit, rank)
			# cards is a list for the purpose of scripting. 
			# add_child adds the node to the scene hierarchy.
			cards.append(new_card)
			add_child(new_card)

# Called when the node enters the scene tree for the first time.
func _ready() -> void:
	add_to_group("players")
	give_all_cards() # temporary, haven't made card dealing yet
	shuffle(cards)
	set_card_positions()


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta: float) -> void:
	pass
