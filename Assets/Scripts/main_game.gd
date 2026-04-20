extends Node2D

var lobby : Dictionary
var player_count = 1
@export var card_tscn : PackedScene

var username2node : Dictionary

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
	var state = payload["room"]["public"]
	var last_action = state["lastAction"]
	var players = state["players"]
	
	if last_action["type"] == "startGame":
		for player in players:
			for i in range(player["hand_count"]):
				var new_card = card_tscn.instantiate()
				new_card.setup_blank()
				var node = username2node[player["username"]] as Player
				node.add_card(new_card)
				node.set_card_positions()
				
func _on_lobby_state(payload: Dictionary):
	var l = payload["lobby"]
	if not lobby or lobby != l:
		lobby = l
		configure_lobby()

func configure_lobby():
	for child in $Players.get_children():
		child.visible = false
		child.process_mode = Node.PROCESS_MODE_DISABLED
		
	player_count = 1
	for player in lobby["players"]:
		var username = player["username"]
		if username == Globals.username:
			username2node[username] = $Players/P1
			username2node[username].player_username = player["username"]
			username2node[username].visible = true
			username2node[username].process_mode = Node.PROCESS_MODE_ALWAYS
		else:
			username2node[username] = $Players.get_child(player_count)
			username2node[username].player_username = player["username"]
			username2node[username].visible = true
			username2node[username].process_mode = Node.PROCESS_MODE_ALWAYS
			player_count += 1
	$"Start Game".disabled = lobby["players"].size() < 2
	
func _on_play_button_pressed():
	NetworkClient.play_card()

func _on_slap_button_pressed():
	NetworkClient.slap()

func _on_button_pressed() -> void:
	init_fake_game()
	
func init_fake_game():
	NetworkClient.login_user("Alice", "secret123")
	NetworkClient.leave_lobby()
	NetworkClient.create_lobby()

func create_cards():
	for suit in Card.Suit.values():
		for rank in Card.Rank.values():
			var new_card = card_tscn.instantiate()
			new_card.setup_blank()
			$"Center Pile".add_child(new_card)
			
func _on_start_game_pressed() -> void:
	NetworkClient.start_game()
	$"Start Game".visible = false


func _on_settings_changed(color: Color, volume: int) -> void:
	# Set color
	var tex = $Background.texture as GradientTexture2D
	var gradient = tex.gradient
	gradient.set_color(0, color)
	gradient.set_color(1, color)
	
	# Set volume
