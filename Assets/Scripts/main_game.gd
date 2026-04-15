extends Node2D

signal game_state (payload: Dictionary)

func _ready() -> void:
	pass
	
func _process (delta: float): 
	var state = await game_state
	_on_game_state(state) 

func _exit_tree() -> void:
	pass

func _on_game_state (payload: Dictionary):
	# update game ui here 
	pass
	
func _on_play_button_pressed ():
	NetworkClient.play_card ()

func _on_slap_button_pressed ():
	NetworkClient.slap ()
