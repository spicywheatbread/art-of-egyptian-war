extends Node2D

@export var card_tscn: PackedScene
@onready var card_flip_sound = $CanvasLayer/PlayCardAudio
@onready var slap_sound1 = $CanvasLayer/SlapAudio1
@onready var _center_pile: Center_Pile = $CanvasLayer/"Center Pile"

var current_game_state = {}
var current_lobby_state = {}

var username_to_node: Dictionary = {}
var _in_online_match: bool = false

var _pile_collect_animating: bool = false
var _pile_collect_sig: String = ""
var _pile_collect_tween: Tween = null
var _prev_pile_count: int = 0
var _prev_hand_counts: Dictionary = {} # username -> int


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

	$CanvasLayer/GameStatus.visible = false

func _on_game_state(payload: Variant) -> void:
	if typeof(payload) != TYPE_DICTIONARY:
		return
	var room_any = payload.get("room")
	if typeof(room_any) != TYPE_DICTIONARY:
		return
	var public_any = room_any.get("public")
	if typeof(public_any) != TYPE_DICTIONARY:
		return

	current_game_state = public_any
	match String(current_game_state.get("status", "")):
		"InGame":
			_in_online_match = true
			_apply_in_game_state(current_game_state)
			$CanvasLayer/GameStatus.visible = true
		"GameOver":
			_in_online_match = false
			_set_player_network_drag(false)
			_apply_game_over_state(current_game_state)
		"Lobby":
			_in_online_match = false
			_set_player_network_drag(false)
			var st_lobby = get_node_or_null("GameStatus") as Label
			if st_lobby:
				st_lobby.visible = false

func _apply_in_game_state(state: Dictionary) -> void:
	var players: Array = state.get("players", [])
	var hand_counts_now: Dictionary = {}
	var best_delta: int = -999999
	var best_user: String = ""
	for p in players:
		if typeof(p) != TYPE_DICTIONARY:
			continue
		var username = str(p.get("username", ""))
		var hand_count = _to_int_safe(p.get("hand_count", 0))
		hand_counts_now[username] = hand_count
		var prev_count := _to_int_safe(_prev_hand_counts.get(username, hand_count))
		var delta: int = int(hand_count - prev_count)
		if delta > best_delta:
			best_delta = delta
			best_user = username
		var player_node = username_to_node.get(username) as Player
		player_node.set_hand_card_count(hand_count)
		player_node.set_label_turn(username == get_current_turn_username())

	var pile_any: Variant = state.get("pileCards", [])
	var current_pile_count := (pile_any as Array).size() if typeof(pile_any) == TYPE_ARRAY else 0

	var lastAction = state.get("lastAction")
	if lastAction.get("type") == "dragCard":
		var p = username_to_node[get_current_turn_username()]
		var pos_dict = lastAction.get("globalPosition")
		var pos = Vector2(float(pos_dict.get("x")), float(pos_dict.get("y")))
		p.display_dragged(pos)
		
	if not _pile_collect_animating:
		var started = _maybe_animate_center_pile_to_winner(state, best_user, best_delta)
		if not started:
			_rebuild_center_pile_from_server(state.get("pileCards", []), state.get("pileCardsPositions", []))
	_prev_pile_count = current_pile_count
	_prev_hand_counts = hand_counts_now

	var turn_line = _format_turn_line(state).to_upper()
	var last_line = _format_last_action_line(state.get("lastAction"), players).to_upper()
	$CanvasLayer/GameStatus.text = ("" if last_line.is_empty() else last_line + "\n") + turn_line

func _maybe_animate_center_pile_to_winner(state: Dictionary, winner_username: String, winner_delta: int) -> bool:
	if _center_pile.cards.size() <= 0:
		return false

	var incoming_pile_any: Variant = state.get("pileCards", [])
	if typeof(incoming_pile_any) != TYPE_ARRAY:
		return false
	var incoming_count := (incoming_pile_any as Array).size()
	if not (_prev_pile_count > 0 and incoming_count == 0):
		return false

	# Avoid re-triggering on the same emptied-pile snapshot.
	var sig := str(_prev_pile_count) + "->" + str(incoming_count) + ":" + str(state.get("turn", {})) + ":" + str(state.get("lastAction", {}))
	if sig == _pile_collect_sig:
		return false
	_pile_collect_sig = sig

	# Identify winner as the player whose hand count increased the most this tick.
	if winner_username.is_empty() or winner_delta <= 0:
		return false

	var winner_node := username_to_node.get(winner_username) as Player
	if not winner_node:
		return false

	var target_node := winner_node.get_node_or_null("Cards") as Node2D
	var target_pos := (target_node.global_position if target_node else winner_node.global_position)

	_pile_collect_animating = true
	if _pile_collect_tween and is_instance_valid(_pile_collect_tween):
		_pile_collect_tween.kill()

	_pile_collect_tween = create_tween()
	_pile_collect_tween.set_parallel(true)

	var i := 0
	for child in _center_pile.get_children():
		if not (child is Card):
			continue
		var c := child as Node2D
		c.scale = Vector2.ONE

		c.z_index = 1000 + i
		var jitter := Vector2(randf_range(-18.0, 18.0), randf_range(-18.0, 18.0))
		var delay := float(i) * 0.05
		var dur := 0.75
		_pile_collect_tween.tween_property(c, "global_position", target_pos + jitter, dur)\
			.set_delay(delay)\
			.set_trans(Tween.TRANS_QUAD)\
			.set_ease(Tween.EASE_IN_OUT)
		_pile_collect_tween.tween_property(c, "scale", Vector2(0.35, 0.35), dur)\
			.set_delay(delay)\
			.set_trans(Tween.TRANS_QUAD)\
			.set_ease(Tween.EASE_IN_OUT)

		i += 1

	_pile_collect_tween.finished.connect(func():

		_center_pile.clear_pile()
		_pile_collect_animating = false
	)
	return true
	
func _rebuild_center_pile_from_server(pile_any: Variant, pileCardPositions) -> void:
	_center_pile.clear_pile()
	if typeof(pile_any) != TYPE_ARRAY:
		return

	var count = 0
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
		
		var pos_dict = pileCardPositions[count]
		var pos = Vector2(float(pos_dict.get("x")), float(pos_dict.get("y")))
		if pos.is_equal_approx(Vector2(0, 0)):
			c.global_position = $"CanvasLayer/Center Pile".global_position
		else:
			c.global_position = pos
		count += 1
		
func _on_lobby_state(payload: Dictionary) -> void:
	var l = payload["lobby"]
	if not current_lobby_state or current_lobby_state != l:
		current_lobby_state = l
		configure_lobby()


func configure_lobby() -> void:
	$CanvasLayer/JoinCode/JoinCodeLabel.text = "CODE: " + current_lobby_state["gameCode"]

	for child in $CanvasLayer/Players.get_children():
		child.visible = false
		child.process_mode = Node.PROCESS_MODE_DISABLED

	username_to_node.clear()
	
	# Find host and current player
	var player_count = current_lobby_state["players"].size()
	var is_host = false

	for i in range(player_count):
		var player = current_lobby_state["players"][i]
		var username = player["username"]
		var player_node = $CanvasLayer/Players.get_child(i) as Player
		username_to_node[username] = player_node
		player_node.setup(username)
		if Globals.username == player["username"]:
			player_node.set_username_color_me()
			if player["playerId"] == current_lobby_state["hostPlayerId"]:
				is_host = true
				
	$CanvasLayer/"Start Game".visible = is_host && player_count >= 2
	
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
			# Enable chatting
			for username in username_to_node:
				if Globals.username == username:
					username_to_node[username].get_node("Chat").show_chat_toggle()
			return "Started."
		"playCard":
			card_flip_sound.play()
			return "Card played by " + name
		"slap":
			slap_sound1.play()
			var ok = la.get("wasSuccessful", false)
			
			if ok:
				return "Good slap by " + name + "!"
			
			var burned = str(int(la.get("burnedCount", 0)))
			return "Bad slap! " + name + " burned %s cards" % burned
		"sendChat":
			var emoji_number = la.get("emojiNumber")
			var player_node = username_to_node.get(name) as Player
			player_node.get_node("Chat").display_emoji(emoji_number)
			
			# Return previous value
			return $CanvasLayer/GameStatus.text.split("\n")[0]
		_:
			return ""

func get_current_turn_username() -> String: 
	var turn = current_game_state.get("turn")
	if typeof(turn) != TYPE_DICTIONARY:
		return ""
	var tid = turn.get("currentPlayerId", "")
	var players = current_game_state.get("players", [])
	for p in players:
		if p.get("playerId", "") == tid:
			return p.get("username", "")
			
	# if we reach here, something is messed up
	print("Can't match turn to player for id:", tid)
	return ""
	
func _to_int_safe(v: Variant) -> int:
	if v == null:
		return 0
	if typeof(v) == TYPE_FLOAT:
		return int(round(v))
	if typeof(v) == TYPE_INT:
		return v
	return int(v)

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
	$CanvasLayer/Background.color = color
	
	card_flip_sound.volume_linear = volume / 100.0
	slap_sound1.volume_linear = volume / 100.0

func _username_for_player_id(state: Dictionary, pid: String) -> String:
	for p in state.get("players", []):
		if typeof(p) != TYPE_DICTIONARY:
			continue
		if str(p.get("playerId", "")) == pid:
			return str(p.get("username", ""))
	return ""
	
func _unhandled_input(event: InputEvent) -> void:
	if not _in_online_match:
		return
	if event is InputEventKey and event.pressed:
		match event.physical_keycode:
			KEY_SPACE:
				var random_position = $"CanvasLayer/Center Pile".global_position + Vector2(randf_range(-10, 10), randf_range(-15, 15))
				NetworkClient.play_card(random_position)
			KEY_S:
				NetworkClient.slap()


func _on_center_pile_input(_viewport: Node, event: InputEvent, _shape_idx: int) -> void:
	if not _in_online_match:
		return
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		NetworkClient.slap()


func _set_player_network_drag(enabled_network_sync: bool) -> void:
	for uname in username_to_node:
		var p = username_to_node[uname] as Player
		if p:
			p.network_sync_hand = enabled_network_sync
