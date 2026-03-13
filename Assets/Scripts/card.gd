class_name Card
extends Area2D

enum Suit {
	SPADES,
	HEARTS,
	DIAMONDS,
	CLUBS
}

enum Rank {
	ACE = 1,
	TWO = 2,
	THREE = 3,
	FOUR = 4,
	FIVE = 5,
	SIX = 6,
	SEVEN = 7,
	EIGHT = 8,
	NINE = 9,
	TEN = 10,
	JACK = 11,
	QUEEN = 12,
	KING = 13,
	
}
const SUIT_NAMES = {
	Suit.SPADES: "Spades",
	Suit.HEARTS: "Hearts",
	Suit.DIAMONDS: "Diamonds",
	Suit.CLUBS: "Clubs"
}

var card_name : String = "Uninitialized Card"
var rank : Rank = Rank.ACE
var suit : Suit = Suit.SPADES

func set_sprite():
	var path = str("res://Assets/Images/Cards/")
# Called when the node enters the scene tree for the first time.
func _ready() -> void:
	pass # Replace with function body.

func setup(rank: Rank, suit: Suit) -> void:
	rank = rank
	suit = suit
	card_name = str(rank, " of ", SUIT_NAMES[suit])
	
# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta: float) -> void:
	pass


func _on_input_event(viewport: Node, event: InputEvent, shape_idx: int) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MouseButton.MOUSE_BUTTON_LEFT and event.pressed:
			print("clicked " + card_name)
			get_viewport().set_input_as_handled()
