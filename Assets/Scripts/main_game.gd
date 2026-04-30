extends Node2D

var lobby: Dictionary = {}
var player_count: int = 1
var username2node: Dictionary = {}

var _in_online_match: bool = false

@export var card_tscn: PackedScene

@onready var _center_pile: Center_Pile = $"Center Pile"


func _ready() -> void:
	# Handle game over
	$GameOver.visible = false
	$GameOver/Popup/Button.pressed.connect(NetworkClient.leave_lobby)
	
	if not NetworkClient.game_state.is_connected(_on_game_state):
		NetworkClient.game_state.connect(_on_game_state)
	if not NetworkClient.lobby_state.is_connected(_on_lobby_state):
		NetworkClient.lobby_state.connect(_on_lobby_state)

	if NetworkClient.last_lobby_state != null:
		_on_lobby_state(NetworkClient.last_lobby_state)

	var center_area := _center_pile.get_node_or_null("Area2D") as Area2D
	if center_area:
		center_area.input_event.connect(_on_center_pile_input)

	_set_play_slap_visible(false)
	var st = get_node_or_null("GameStatus") as Label
	if st:
		st.visible = false

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
	var play_btn = get_node_or_null("Play Card")
	var slap_btn = get_node_or_null("Slap")
	if play_btn:
		play_btn.visible = show_play_slap
	if slap_btn:
		slap_btn.visible = show_play_slap


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
			var st_in = get_node_or_null("GameStatus") as Label
			if st_in:
				st_in.visible = true
		"GameOver":
			_in_online_match = false
			_set_player_network_drag(false)
			_set_play_slap_visible(false)
			_apply_game_over_state(state)
		"Lobby":
			_in_online_match = false
			_set_player_network_drag(false)
			_set_play_slap_visible(false)
			var st_lobby = get_node_or_null("GameStatus") as Label
			if st_lobby:
				st_lobby.visible = false


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
	var last_line = _format_last_action_line(state.get("lastAction")).to_upper()
	var status = get_node_or_null("GameStatus") as Label
	if status:
		status.text = turn_line + ("" if last_line.is_empty() else "\n" + last_line)


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
			$GameOver.visible = true
			if _username_for_player_id(state, winner_id) == Globals.username:
				# Change to winning screen
				$GameOver/Popup/Label.text = "YOU WIN!"
				$GameOver/Popup/LosingIcon.visible = false
				$GameOver/Popup/WinningIcon.visible = true
			
			# Make game components invisible
			$Players/P1.visible = false
			$Players/P2.visible = false
			$Players/P3.visible = false
			$Players/P4.visible = false
			$"Center Pile".visible = false
			
	var status = get_node_or_null("GameStatus") as Label
	if status:
		status.visible = true
		status.text = line.to_upper()
	


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
		return "Turn: YOUR TURN (%s)" % name
	return "Turn: %s" % name


func _format_last_action_line(last_any: Variant) -> String:
	if typeof(last_any) != TYPE_DICTIONARY:
		return ""
	var la: Dictionary = last_any
	match String(la.get("type", "")):
		"startGame":
			return "Started."
		"playCard":
			return "Card played."
		"slap":
			var ok = la.get("wasSuccessful", false)
			if ok:
				return "Good slap!"
			var burned = str(la.get("burnedCount", 0))
			return "Bad slap: burned %s card(s)." % burned
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
	$JoinCode/JoinCodeLabel.text = "CODE: " + lobby["gameCode"]

	for child in $Players.get_children():
		child.visible = false
		child.process_mode = Node.PROCESS_MODE_DISABLED

	player_count = 1
	username2node.clear()
	for player in lobby["players"]:
		var username = player["username"]
		if username == Globals.username:
			username2node[username] = $Players/P1
			setup_player(username)
		else:
			username2node[username] = $Players.get_child(player_count)
			setup_player(username)
			player_count += 1

	$"Start Game".visible = lobby["players"].size() >= 2


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
	NetworkClient.start_game()
	$"Start Game".visible = false
	$JoinCode.visible = false


func _on_settings_changed(color: Color, volume: int) -> void:
	var tex = $Background.texture as GradientTexture2D
	var gradient = tex.gradient
	gradient.set_color(0, color)
	gradient.set_color(1, color)
