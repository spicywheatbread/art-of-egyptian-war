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

const RANK_NAMES = {
	Rank.ACE: "Ace",
	Rank.TWO: "2",
	Rank.THREE: "3",
	Rank.FOUR: "4",
	Rank.FIVE: "5",
	Rank.SIX: "6",
	Rank.SEVEN: "7",
	Rank.EIGHT: "8",
	Rank.NINE: "9",
	Rank.TEN: "10",
	Rank.JACK: "Jack",
	Rank.QUEEN: "Queen",
	Rank.KING: "King",
}

var card_name : String = "Uninitialized Card"
var rank : Rank = Rank.ACE
var suit : Suit = Suit.SPADES

func set_texture():
	var path = "res://Assets/Images/Cards/" + SUIT_NAMES[self.suit] + "/" + str(rank) + ".png"
	var texture = load(path)
	if texture == null:
		texture = load("res://Assets/Images/Cards/Spades/1.png")
	$Sprite2D.texture = texture
		
func setup(suit : Suit, rank : Rank) -> void:
	self.rank = rank
	self.suit = suit
	self.card_name = str(RANK_NAMES[self.rank], " of ", SUIT_NAMES[self.suit])
	set_texture()
	
# Called when the node enters the scene tree for the first time.
func _ready() -> void:
	pass

# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta: float) -> void:
	pass
