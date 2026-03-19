extends Node2D

var card_tscn : PackedScene = preload("res://Assets/Scenes/GameObjects/card.tscn")
var cards = []

func get_top_card():
	return cards.front()
	
# Called when the node enters the scene tree for the first time.
func _ready() -> void:
	var new_card = card_tscn.instantiate()
	new_card.setup(Card.Rank.ACE, Card.Suit.SPADES)
	cards.append(new_card)


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta: float) -> void:
	pass


func _on_area_2d_input_event(viewport: Node, event: InputEvent, shape_idx: int) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MouseButton.MOUSE_BUTTON_LEFT and event.pressed:
			print(get_top_card().card_name)
