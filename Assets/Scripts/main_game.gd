extends Node2D

# Variable definition
var lobby : Dictionary
var player_count = 1
var username2node : Dictionary

# Node references
@export var card_tscn : PackedScene

func _ready() -> void:
	# Connect signals
	NetworkClient.game_state.connect(_on_game_state)
	NetworkClient.lobby_state.connect(_on_lobby_state)
	
	# Fetch most recent lobby state
	if NetworkClient.last_lobby_state != null:
		_on_lobby_state(NetworkClient.last_lobby_state)
	
func _process (delta: float): 
	pass

func _exit_tree() -> void:
	pass

# Load game state
func _on_game_state (payload: Dictionary):
	var state = payload["room"]["public"]
	var last_action = state["lastAction"]
	var players = state["players"]
	
	# Setup game and cards
	if last_action["type"] == "startGame":
		deal_cards(players)
	
func deal_cards(players):
	for player in players:
		for i in range(player["hand_count"]):
			var new_card = card_tscn.instantiate()
			new_card.setup_blank()
			var node = username2node[player["username"]] as Player
			node.add_card(new_card)
			node.set_card_positions()

# Load lobby state
func _on_lobby_state(payload: Dictionary):
	var l = payload["lobby"]
	if not lobby or lobby != l:
		lobby = l
		configure_lobby()

func configure_lobby():
	# Display join code
	$JoinCode/JoinCodeLabel.text = "CODE: " + lobby["gameCode"]

	# Hide then redisplay players according to new lobby state
	for child in $Players.get_children():
		child.visible = false
		child.process_mode = Node.PROCESS_MODE_DISABLED

	player_count = 1
	for player in lobby["players"]:
		var username = player["username"]
		if username == Globals.username:
			username2node[username] = $Players/P1
			setup_player(username)
		else:
			username2node[username] = $Players.get_child(player_count)
			setup_player(username)
			player_count += 1
			
	# Enable start button with enough players (>2)
	$"Start Game".visible = lobby["players"].size() >= 2
	
# Sets up and displays the player node
func setup_player(username : String) -> void:
	username2node[username].set_player_username(username)
	username2node[username].visible = true
	username2node[username].process_mode = Node.PROCESS_MODE_ALWAYS
	
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
	$JoinCode.visible = false


func _on_settings_changed(color: Color, volume: int) -> void:
	# Set color
	var tex = $Background.texture as GradientTexture2D
	var gradient = tex.gradient
	gradient.set_color(0, color)
	gradient.set_color(1, color)
	
	# Set volume
