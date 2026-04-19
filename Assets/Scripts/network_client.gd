extends Node

signal connected() 
signal disconnected()
signal auth_ok (username: String)
signal lobby_state(payload: Dictionary)
signal game_state (payload: Dictionary)
signal stats_state(payload: Dictionary)

@export var websocket_url: String = "ws://127.0.0.1:8080" 
#@export var auto_reconnect: bool = false 

var _socket: WebSocketPeer = WebSocketPeer.new()
var _is_connected: bool = false

var last_lobby_state = null

# Called when the node enters the scene tree for the first time.
func _ready() -> void:
	set_process(true) 
	connect_backend()

# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta: float) -> void:
	_poll_socket()
	
func connect_backend():
	# Initiate connection to the given URL
	var err = _socket.connect_to_url(websocket_url)
	if err == OK:
		print("Connecting to %s..." % websocket_url)
		# Wait for the socket to connect.
		await get_tree().create_timer(2).timeout
	else:
		push_error("Unable to connect.")
		set_process(false)
	
func send_json (payload: Dictionary):
	if _socket.get_ready_state() != WebSocketPeer.STATE_OPEN:
		print ("failed") 
		return 
	else:
		_socket.send_text(JSON.stringify(payload))


func register_user (username: String, password: String):
	send_json({"type": "register", "username": username, "password": password})
	var response = await auth_ok
	
	if response == null:
		return "Invalid"
		
	# Set username and go to lobby
	Globals.username = response["username"]
	get_tree().change_scene_to_file("res://Assets/Scenes/Lobby.tscn")

func login_user (username: String, password: String):
	send_json({"type": "login", "username": username, "password": password})
	var response = await auth_ok
	
	if response == null:
		return "Invalid Credentials"
		
	# Set username and go to lobby
	Globals.username = response["username"]
	get_tree().change_scene_to_file("res://Assets/Scenes/Lobby.tscn")

func get_stats():
	send_json({ "type": "getMyStats" })
	return await stats_state
	

func create_lobby (): 
	send_json({ "type": "createLobby", "username": Globals.username })
	var response = await lobby_state
		
	# Set lobby codeand go to game
	Globals.lobby_code = response["lobby"]["gameCode"]
	get_tree().change_scene_to_file("res://Assets/Scenes/Game.tscn")

func join_lobby (game_code: String):
	send_json({ "type": "joinLobby", "gameCode": game_code })
	var response = await lobby_state

	if response == null:
		return false
		
	# Set lobby code and go to game
	Globals.lobby_code = response["lobby"]["gameCode"]
	get_tree().change_scene_to_file("res://Assets/Scenes/Game.tscn")
	
func leave_lobby ():
	send_json({ "type": "leaveLobby" })
	get_tree().change_scene_to_file("res://Assets/Scenes/Lobby.tscn")

func start_game():
	send_json({"type": "startGame"})
	
func play_card ():
	pass 

func slap ():
	pass 


func _poll_socket ():
	# Data transfer and state updates will only happen when calling this function.
	_socket.poll()
	
	# get_ready_state() tells you what state the socket is in.
	var state = _socket.get_ready_state()

	# `WebSocketPeer.STATE_OPEN` means the socket is connected and ready
	# to send and receive data.
	if state == WebSocketPeer.STATE_OPEN:
		while _socket.get_available_packet_count():
			var packet = _socket.get_packet()
			if _socket.was_string_packet():
				var packet_text = packet.get_string_from_utf8()
				var response = JSON.parse_string(packet_text)
				print(response)
				
				# Emit signal based on type received
				match response["type"]:
					"authOk":
						auth_ok.emit(response)
					"myStats":
						stats_state.emit(response)
					"lobbyState":
						last_lobby_state = response
						lobby_state.emit(response)
					"gameState":
						game_state.emit (response) 
					"error":
						match response["code"]:
							"INVALID_USERNAME", "INVALID_PASSWORD", "INVALID_CREDENTIALS":
								auth_ok.emit(null)
							"ROOM_NOT_FOUND", "INVALID_GAME_CODE":
								lobby_state.emit(null)
						
			else:
				print("< Got binary data from server: %d bytes" % packet.size())

	# `WebSocketPeer.STATE_CLOSING` means the socket is closing.
	# It is important to keep polling for a clean close.
	elif state == WebSocketPeer.STATE_CLOSING:
		pass

	# `WebSocketPeer.STATE_CLOSED` means the connection has fully closed.
	# It is now safe to stop polling.
	elif state == WebSocketPeer.STATE_CLOSED:
		# The code will be `-1` if the disconnection was not properly notified by the remote peer.
		var code = _socket.get_close_code()
		print("WebSocket closed with code: %d. Clean: %s" % [code, code != -1])
		set_process(false) # Stop processing.
