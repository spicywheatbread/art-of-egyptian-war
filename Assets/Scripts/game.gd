extends Node2D

var card_tscn : PackedScene

var center_position : Vector2

var selected_card
var previous_position : Vector2
var original_position = Vector2.ZERO
var is_mouse_down = false

# Called when the node enters the scene tree for the first time.
func _ready() -> void:
	for player in get_tree().get_nodes_in_group("players"):
		player.clicked.connect(_on_player_clicked)
		
# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta: float) -> void:
	pass


func _on_button_pressed() -> void:
	pass
	
func _on_player_clicked(player):
	selected_card = player.get_top_card()
	original_position = selected_card.position
	is_mouse_down = true
	
func _input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.pressed:
			is_mouse_down = not is_mouse_down

func _physics_process(delta: float) -> void:
	if selected_card and is_mouse_down:
		selected_card.global_position = get_global_mouse_position()
		
