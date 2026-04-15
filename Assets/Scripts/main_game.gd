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
	
	if NetworkClient.last_lobby_state != null:
		_on_lobby_state(NetworkClient.last_lobby_state)
	
func _process (delta: float): 
	pass

func _exit_tree() -> void:
	pass

func _on_game_state (payload: Dictionary):
	for key in payload.keys():
		print("Key: ", key)
		print("Value: ", payload[key])
	
func _on_lobby_state(payload: Dictionary):
	print("called")
	var l = payload["lobby"]
	if not lobby or lobby != l:
		lobby = l
		configure_lobby()

func configure_lobby():
	var count = 1
	for child in $Players.get_children():
		child.visible = false
		child.process_mode = Node.PROCESS_MODE_DISABLED
		
	for player in lobby["players"]:
		if player["username"] == Globals.username:
			$Players/P1.player_username = player["username"]
			$Players/P1.visible = true
			$Players/P1.process_mode = Node.PROCESS_MODE_ALWAYS
		else:
			$Players.get_child(count).player_username = player["username"]
			$Players.get_child(count).visible = true
			$Players.get_child(count).process_mode = Node.PROCESS_MODE_ALWAYS
			count += 1
	
func _on_play_button_pressed ():
	NetworkClient.play_card ()

func _on_slap_button_pressed ():
	NetworkClient.slap ()


func _on_button_pressed() -> void:
	init_fake_game()
	
func init_fake_game():
	NetworkClient.login_user("Alice", "secret123")
	NetworkClient.leave_lobby()
	NetworkClient.create_lobby()
