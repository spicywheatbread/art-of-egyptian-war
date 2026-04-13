extends Node2D
@export var websocket_url: String = "ws://127.0.0.1:8080"
@export var auto_connect: bool = true
@export var center_pile: Node

signal backend_connected()
signal backend_disconnected()
signal auth_ok(payload: Dictionary)
signal lobby_state(payload: Dictionary)
signal game_state(payload: Dictionary)
signal backend_error(code: String, message: String)

var socket = WebSocketPeer.new()
var is_backend_connected = false

func _ready() -> void:
	if auto_connect:
		connect_backend()

func _process(_delta: float) -> void:
	poll_backend()

func connect_backend() -> void:
	if socket.get_ready_state() == WebSocketPeer.STATE_OPEN or socket.get_ready_state() == WebSocketPeer.STATE_CONNECTING:
		return

	var err := socket.connect_to_url(websocket_url)
	if err != OK:
		push_error("Failed to connect to backend: %s (%s)" % [websocket_url, error_string(err)])
		return

	print("Connecting to backend at: ", websocket_url)

func disconnect_backend() -> void:
	if socket.get_ready_state() == WebSocketPeer.STATE_OPEN or socket.get_ready_state() == WebSocketPeer.STATE_CONNECTING:
		socket.close()

func poll_backend() -> void:
	if socket.get_ready_state() == WebSocketPeer.STATE_CLOSED:
		if is_backend_connected:
			is_backend_connected = false
			emit_signal("backend_disconnected")
		return

	socket.poll()

	if socket.get_ready_state() == WebSocketPeer.STATE_OPEN and not is_backend_connected:
		is_backend_connected = true
		emit_signal("backend_connected")
		print("Connected to backend")

	while socket.get_available_packet_count() > 0:
		var packet = socket.get_packet()
		if not socket.was_string_packet():
			continue
		var raw = packet.get_string_from_utf8()
		var parsed = JSON.parse_string(raw)
		handle_server_message(parsed)

func handle_server_message(msg: Dictionary) -> void:
	var msg_type := String(msg.get("type", ""))
		"lobbyState":
			emit_signal("lobby_state", msg)

		"gameState":
			emit_signal("game_state", msg)
			# TODO = = == = == = = = == == = = = == ===== = = = == = = = = = = = 
			# this is where we handle the game state changing 

		"error":
			var code := String(msg.get("code", "UNKNOWN"))
			var text := String(msg.get("message", "Unknown error"))
			print("Backend error [%s]: %s" % [code, text])
			emit_signal("backend_error", code, text)

		_:
			print("Unhandled backend message: ", msg)

func send_json(payload: Dictionary) -> bool:
	if socket.get_ready_state() != WebSocketPeer.STATE_OPEN:
		push_warning("Socket is not open, cannot send payload")
		return false

	var text = JSON.stringify(payload)
	var err = socket.send_text(text)
	if err != OK:
		push_warning("Failed to send payload: %s" % error_string(err))
		return false
	return true

func create_lobby(settings := {}) -> bool:
	var payload = { "type": "createLobby" }
	if not settings.is_empty():
		payload["settings"] = settings
	return send_json(payload)

func join_lobby(game_code: String) -> bool:
	return send_json({
		"type": "joinLobby",
		"gameCode": game_code,
	})

func leave_lobby() -> bool:
	return send_json({ "type": "leaveLobby" })

func start_game() -> bool:
	return send_json({ "type": "startGame" })

func play_card() -> bool:
	return send_json({ "type": "playCard" })

func slap() -> bool:
	return send_json({ "type": "slap" })



# just fo me TODO delte 
#Goal: Collect all the cards in your hand.

#1. Shuffle and deal the cards out to all players. The players must keep their cards face down, in hand. Egyptian War is played clockwise from the dealer.
#
#2. The player left of the dealer (we’ll call the person Player A) goes first by flipping his/her card face up in the middle of the table.
#
#There are two basic scenarios:
#– If the card reveals a number from 2 – 10, nothing happens. The next person to the left (Player B) flips his/her card, and the game continues on.
#– If Player A flips a royal card (Jack, Queen, King, or Ace), then Player B has a certain number of chances to flip over a royal card:
#
#Royal Cards
#Jack- One Chance to flip a royal card
#Queen- Two Chances to flip a royal card
#King- Three Chances to flip a royal card
#Ace- Four Chances to flip a royal card
#
#Example: If Player A reveals a King, then Player B has to flip three cards to try to reveal a royal card. If Player B flips a royal card within his/her chances, then the next player has a certain number of chances to flip a royal card.
#
#If a player does not flip over a royal card within his/her chances, then the previous player who had the royal card collects the middle card pile. The game resumes again with the collector flipping his/her card.
#
#3. If a player flips a royal card, the same thing occurs from Step 2 with the next players. The game is played clockwise, until one person has all of the cards and is the ultimate winner.
#
#Variation:
#– Many people play with “sandwiches”. In this case, if the cards 4, 7, 4 are flipped, the first person to slap the middle cards wins the pile. (Other examples include King Queen King, 3 8 3, etc.)
