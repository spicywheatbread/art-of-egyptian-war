extends Node2D

var card_tscn : PackedScene = preload("res://Assets/Scenes/card.tscn")
var cards = []

func get_top_card():
	return cards.back()
	
func shuffle(deck: Array) -> void:
	# Fisher-Yates shuffle
	var n = deck.size()
	for i in range(n - 1, 0, -1):
		var j = randi() % (i + 1)  # pick a random index from 0 to i
		var temp = deck[i]
		deck[i] = deck[j]
		deck[j] = temp
		
func set_card_positions() -> void:
	var offset = Vector2(0, -0.5)
	for i in range(cards.size()):
		cards[i].position = i * offset
		
# Called when the node enters the scene tree for the first time.
func _ready() -> void:
	for suit in Card.Suit.values():
		for rank in Card.Rank.values():
			var new_card = card_tscn.instantiate()
			new_card.setup(suit, rank)
			# cards is a list for the purpose of scripting. 
			# add_child adds the node to the scene hierarchy.
			cards.append(new_card)
			add_child(new_card)
			
	shuffle(cards)
	set_card_positions()


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta: float) -> void:
	pass


func _on_area_2d_input_event(viewport: Node, event: InputEvent, shape_idx: int) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MouseButton.MOUSE_BUTTON_LEFT and event.pressed:
			print(get_top_card().card_name)
