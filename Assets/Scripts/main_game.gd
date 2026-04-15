extends Node2D

var lobby : Dictionary
@export var player_tscn : PackedScene
var player_offsets = [
	Vector2(0, -100),
	Vector2(0, 100),
	Vector2(200, 0),
	Vector2(-200, 0),
]

func _ready() -> void:
	NetworkClient.game_state.connect(_on_game_state)
	NetworkClient.lobby_state.connect(_on_lobby_state)
	
func _process (delta: float): 
	pass

func _exit_tree() -> void:
	pass

func _on_game_state (payload: Dictionary):
	for key in payload.keys():
		print("Key: ", key)
		print("Value: ", payload[key])
	
func _on_lobby_state(payload: Dictionary):
	var l = payload["lobby"]
	if lobby != l:
		lobby = l
		redraw_lobby()

func redraw_lobby():
	pass
	
func _on_play_button_pressed ():
	NetworkClient.play_card ()

func _on_slap_button_pressed ():
	NetworkClient.slap ()
