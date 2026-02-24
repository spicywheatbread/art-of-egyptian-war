extends Node

@export var card_tscn : PackedScene
var suits = ["Hearts", "Clubs", "Spades", "Diamonds" ]
var cards = []
var deck_position : Vector2

# Called when the node enters the scene tree for the first time.
func _ready() -> void:
	deck_position = $"Deck Position".position
	for suit in suits:
		for rank in range(1, 14):
			var new_card = card_tscn.instantiate()
			new_card.setup(rank, suit)
			new_card.scale = Vector2(0.1, 0.1)
			cards.append(new_card)
			add_child(new_card)
			
func reset_deck() -> void:
	for card in cards:
		card.position = deck_position
		
# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta: float) -> void:
	pass


func _on_button_pressed() -> void:
	reset_deck()
