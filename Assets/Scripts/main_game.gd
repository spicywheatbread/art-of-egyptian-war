extends Node2D

var lobby: Dictionary = {}
var username2node: Dictionary = {}

var _in_online_match: bool = false

@export var card_tscn: PackedScene
@onready var card_flip_sound = $CanvasLayer/AudioStreamPlayer2D
@onready var _center_pile: Center_Pile = $CanvasLayer/"Center Pile"


func _ready() -> void:
	# Handle game over
	$CanvasLayer/GameOver.visible = false
	$CanvasLayer/GameOver/Popup/Button.pressed.connect(NetworkClient.leave_lobby)
	
	if not NetworkClient.game_state.is_connected(_on_game_state):
		NetworkClient.game_state.connect(_on_game_state)
	if not NetworkClient.lobby_state.is_connected(_on_lobby_state):
		NetworkClient.lobby_state.connect(_on_lobby_state)

	if NetworkClient.last_lobby_state != null:
		_on_lobby_state(NetworkClient.last_lobby_state)

	$"CanvasLayer/Center Pile/Area2D".input_event.connect(_on_center_pile_input)

	_set_play_slap_visible(false)
	$CanvasLayer/GameStatus.visible = false

func _unhandled_input(event: InputEvent) -> void:
	if not _in_online_match:
		return
	if event is InputEventKey and event.pressed:
		match event.physical_keycode:
			KEY_SPACE:
				NetworkClient.play_card()
			KEY_S:
				NetworkClient.slap()


func _on_center_pile_input(_viewport: Node, event: InputEvent, _shape_idx: int) -> void:
	if not _in_online_match:
		return
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		NetworkClient.slap()


func _set_play_slap_visible(show_play_slap: bool) -> void:
	$"CanvasLayer/Play Card".visible = show_play_slap

func _set_player_network_drag(enabled_network_sync: bool) -> void:
	for uname in username2node:
		var p = username2node[uname] as Player
		if p:
			p.network_sync_hand = enabled_network_sync


func _on_game_state(payload: Variant) -> void:
	if typeof(payload) != TYPE_DICTIONARY:
		return
	var room_any = payload.get("room")
	if typeof(room_any) != TYPE_DICTIONARY:
		return
	var public_any = room_any.get("public")
	if typeof(public_any) != TYPE_DICTIONARY:
		return

	var state: Dictionary = public_any
	match String(state.get("status", "")):
		"InGame":
			_in_online_match = true
			_apply_in_game_state(state)
			_set_play_slap_visible(true)
			$CanvasLayer/GameStatus.visible = true
		"GameOver":
			_in_online_match = false
			_set_player_network_drag(false)
			_set_play_slap_visible(false)
			_apply_game_over_state(state)
		"Lobby":
			_in_online_match = false
			_set_player_network_drag(false)
			_set_play_slap_visible(false)
			$CanvasLayer/GameStatus.visible = false


func _apply_in_game_state(state: Dictionary) -> void:
	_set_player_network_drag(true)

	var players: Array = state.get("players", [])
	for p in players:
		if typeof(p) != TYPE_DICTIONARY:
			continue
		var uname = str(p.get("username", ""))
		var hand_n = _to_int_safe(p.get("hand_count", 0))
		var node = username2node.get(uname) as Player
		if node:
			node.set_hand_card_count(hand_n)

	_rebuild_center_pile_from_server(state.get("pileCards", []))

	var turn_line = _format_turn_line(state).to_upper()
	var last_line = _format_last_action_line(state.get("lastAction"), players).to_upper()
	$CanvasLayer/GameStatus.text = ("" if last_line.is_empty() else last_line + "\n") + turn_line


func _apply_game_over_state(state: Dictionary) -> void:
	var stats_any = state.get("finalStats")
	var line = "Game over."
	if typeof(stats_any) == TYPE_DICTIONARY:
		var fs: Dictionary = stats_any
		var winner_id = str(fs.get("winnerPlayerId", ""))
		if winner_id != "":
			line = _username_for_player_id(state, winner_id)
			line = ("Winner: %s" % line) if line.length() > 0 else "Game over."
			
			# Show the game over panel
			$CanvasLayer/GameOver.visible = true
			if _username_for_player_id(state, winner_id) == Globals.username:
				# Change to winning screen
				$CanvasLayer/GameOver/Popup/Label.text = "YOU WIN!"
				$CanvasLayer/GameOver/Popup/LosingIcon.visible = false
				$CanvasLayer/GameOver/Popup/WinningIcon.visible = true
			
			# Make game components invisible
			$CanvasLayer/Players/P1.visible = false
			$CanvasLayer/Players/P2.visible = false
			$CanvasLayer/Players/P3.visible = false
			$CanvasLayer/Players/P4.visible = false
			$CanvasLayer/"Center Pile".visible = false
			
	$CanvasLayer/GameStatus.visible = true
	$CanvasLayer/GameStatus.text = line.to_upper()


func _username_for_player_id(state: Dictionary, pid: String) -> String:
	for p in state.get("players", []):
		if typeof(p) != TYPE_DICTIONARY:
			continue
		if str(p.get("playerId", "")) == pid:
			return str(p.get("username", ""))
	return ""


func _format_turn_line(state: Dictionary) -> String:
	var turn_any = state.get("turn")
	if typeof(turn_any) != TYPE_DICTIONARY:
		return ""
	var tid = str((turn_any as Dictionary).get("currentPlayerId", ""))
	if tid.is_empty():
		return "Turn: X"
	var name = ""
	for p in state.get("players", []):
		if typeof(p) != TYPE_DICTIONARY:
			continue
		if str(p.get("playerId", "")) == tid:
			name = str(p.get("username", ""))
			break
	if name.is_empty():
		return "Turn: (unknown)"
	if name == Globals.username:
		return "Turn: You (%s)" % name
	return "Turn: %s" % name


func _format_last_action_line(last_any: Variant, players: Variant) -> String:
	if typeof(last_any) != TYPE_DICTIONARY:
		return ""
	var la: Dictionary = last_any
	
	# Player who acted
	var name = "?"
	var playerId = la.get("byPlayerId")
	for player in players:
		if str(player.get("playerId", "")) == playerId:
			name = str(player.get("username", ""))
			break
					
	match String(la.get("type", "")):
		"startGame":
			$CanvasLayer/JoinCode.visible = false
			return "Started."
		"playCard":
			return "Card played by " + name
		"slap":
			var ok = la.get("wasSuccessful", false)
			
			if ok:
				return "Good slap by " + name + "!"
			
			var burned = str(int(la.get("burnedCount", 0)))
			return "Bad slap! " + name + " burned %s cards" % burned
		_:
			return ""


func _to_int_safe(v: Variant) -> int:
	if v == null:
		return 0
	if typeof(v) == TYPE_FLOAT:
		return int(round(v))
	if typeof(v) == TYPE_INT:
		return v
	return int(v)


func _rebuild_center_pile_from_server(pile_any: Variant) -> void:
	card_flip_sound.play()
	_center_pile.clear_pile()
	if typeof(pile_any) != TYPE_ARRAY:
		return

	for item in pile_any:
		if typeof(item) != TYPE_DICTIONARY:
			continue
		var cd: Dictionary = item
		if cd.get("isJoker", false):
			continue
		var suit_i = _to_int_safe(cd.get("suit", 0))
		var rank_i = _to_int_safe(cd.get("rank", 1))
		var c = card_tscn.instantiate() as Card
		c.setup(suit_i, rank_i)
		_center_pile.add_card(c)


func _process(_delta: float) -> void:
	pass


func _exit_tree() -> void:
	pass


func _on_lobby_state(payload: Dictionary) -> void:
	var l = payload["lobby"]
	if not lobby or lobby != l:
		lobby = l
		configure_lobby()


func configure_lobby() -> void:
	$CanvasLayer/JoinCode/JoinCodeLabel.text = "CODE: " + lobby["gameCode"]

	for child in $CanvasLayer/Players.get_children():
		child.visible = false
		child.process_mode = Node.PROCESS_MODE_DISABLED

	username2node.clear()
	
	# Find host and current player
	var player_count = lobby["players"].size()
	var is_host = false
	var curr_player_index
	for i in range(player_count):
		var player = lobby["players"][i]
		
		var username = player["username"]
		if username == Globals.username:
			username2node[username] = $CanvasLayer/Players/P1
			setup_player(username)
			
			curr_player_index = i
			
			# Find host
			if player["playerId"] == lobby["hostPlayerId"]:
				is_host = true

	# Render the rest of players
	for i in range(player_count):
		if i != curr_player_index:
			var player = lobby["players"][i]
			
			var username = player["username"]
			if i < curr_player_index:
				username2node[username] = $CanvasLayer/Players.get_child((i + player_count - curr_player_index))
			else:
				username2node[username] = $CanvasLayer/Players.get_child(i - curr_player_index)
			setup_player(username)
				
	$CanvasLayer/"Start Game".visible = is_host && player_count >= 2


func setup_player(username: String) -> void:
	var node = username2node[username] as Player
	node.set_player_username(username)
	node.visible = true
	node.process_mode = Node.PROCESS_MODE_ALWAYS


func _on_play_button_pressed() -> void:
	NetworkClient.play_card()


func _on_slap_button_pressed() -> void:
	NetworkClient.slap()


func _on_button_pressed() -> void:
	init_fake_game()


func init_fake_game() -> void:
	NetworkClient.login_user("Alice", "secret123")
	NetworkClient.leave_lobby()
	NetworkClient.create_lobby()


func _on_start_game_pressed() -> void:
	$CanvasLayer/"Start Game".visible = false
	$CanvasLayer/JoinCode.visible = false
	NetworkClient.start_game()


func _on_settings_changed(color: Color, volume: int) -> void:
	var tex = $CanvasLayer/Background.texture as GradientTexture2D
	var gradient = tex.gradient
	gradient.set_color(0, color)
	gradient.set_color(1, color)
	
	$CanvasLayer/AudioStreamPlayer2D.volume_linear = volume / 100.0
