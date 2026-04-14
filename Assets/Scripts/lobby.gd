extends Node2D

@export var QuoteDisplay : Node
@export var HostConfirmGame : Node
@export var JoinConfirmGame : Node
@export var Profile : Node
@export var WelcomeMessage : Node
@export var StatsDisplay : Node
@export var JoinCodeInput : Node


var socket = WebSocketPeer.new()
var websocket_url = "ws://127.0.0.1:8080" # Localhost


var quotes = ["Victorious warriors win first...",
	"The greatest victory is that which requires no battle.",
	"In the midst of chaos, there is also opportunity.",
	"If you know the enemy and know yourself...",
	"Appear weak when you are strong...",
	"Let your plans be dark and impenetrable as night...",
	"Move swift as the Wind... be still as the Mountain.",
	"Regard your soldiers as your children...",
	"Rewards for good service should not be deferred...",
	"All warfare is based on deception.",
	"Attack is the secret of defense."
]


# Called when the node enters the scene tree for the first time.
func _ready() -> void:
	# Hide on start
	HostConfirmGame.visible = false
	JoinConfirmGame.visible = false
	Profile.visible = false
	
	# Display welcome and stats on start
	WelcomeMessage.text = "WELCOME,\n" + Globals.username.to_upper() + "!"
	StatsDisplay.text = "GAMES PLAYED: " + Globals.games_played + "\n\nGAMES WON: " + Globals.games_won
	
	# Choose random quote
	var random_int = randi() % quotes.size()
	QuoteDisplay.text = quotes[random_int].to_upper()
	
	
	# Initiate connection to the given URL.
	var err = socket.connect_to_url(websocket_url)
	if err == OK:
		print("Connecting to %s..." % websocket_url)
		# Wait for the socket to connect.
		await get_tree().create_timer(2).timeout
	else:
		push_error("Unable to connect.")
		set_process(false)


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta: float) -> void:
	# Data transfer and state updates will only happen when calling this function.
	socket.poll()

	# get_ready_state() tells you what state the socket is in.
	var state = socket.get_ready_state()

	# `WebSocketPeer.STATE_OPEN` means the socket is connected and ready
	# to send and receive data.
	if state == WebSocketPeer.STATE_OPEN:
		while socket.get_available_packet_count():
			var packet = socket.get_packet()
			if socket.was_string_packet():
				var packet_text = packet.get_string_from_utf8()
				var response = JSON.parse_string(packet_text)
				print(response)
				
				# Handle error
				if response["type"] == "error":
					print(response)
				else:
					# Change scene to lobby upon creation or joining
					if response["type"] == "lobbyState":
						# Set lobby_id in Global variables
						Globals.lobby_code = response["gameCode"]
				
						# Switch the lobby after getting/confirming lobby ID
						get_tree().change_scene_to_file("res://Assets/Scenes/GameObjects/test.tscn")

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
		var code = socket.get_close_code()
		print("WebSocket closed with code: %d. Clean: %s" % [code, code != -1])
		set_process(false) # Stop processing.


func _on_host_game_button_pressed() -> void:
	HostConfirmGame.visible = true
	
func _on_join_game_button_pressed() -> void:
	JoinConfirmGame.visible = true
	
func _close_popup() -> void:
	HostConfirmGame.visible = false
	JoinConfirmGame.visible = false
	
func _on_profile_button_pressed() -> void:
	Profile.visible = true

func _on_profile_close_button_pressed() -> void:
	Profile.visible = false
	
	
func _on_join_code_input_text_changed(new_text: String) -> void:
	# Store current cursor position
	var caret_pos = JoinCodeInput.caret_column
	# Convert text to uppercase
	JoinCodeInput.text = new_text.to_upper()
	# Restore cursor position
	JoinCodeInput.caret_column = caret_pos


func _on_host_game_confirm_button_pressed() -> void:
	var new_lobby = JSON.stringify({ "type": "createLobby", "username": Globals.username })
	socket.send_text(new_lobby)
	# Sending new lobby triggers scene change in process function on success
	
func _on_join_game_confirm_button_pressed() -> void:
	var join_lobby = JSON.stringify({ "type": "joinLobby", "gameCode": JoinCodeInput.text })
	socket.send_text(join_lobby)
	# Sending join lobby triggers scene change in process function on success
