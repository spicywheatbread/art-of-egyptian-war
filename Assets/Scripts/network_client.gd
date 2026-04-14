extends Node

signal connected() 
signal disconnected()
signal auth_ok (username: String)
signal lobby_state(payload: Dictionary)
signal game_state (payload: Dictionary)

@export var websocket_url: String = "ws://127.0.0.1:8080" 
#@export var auto_reconnect: bool = false 

var _socket: WebSocketPeer = WebSocketPeer.new()
var _is_connected: bool = false

# Called when the node enters the scene tree for the first time.
func _ready() -> void:
	set_process(true) 
	 # Replace with function body.

# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta: float) -> void:
	_poll_socket()
	
func connect_backend():
	var state = _socket.get_ready_state()
	# TODO add some err handling? 
	
func send_json (payload: Dictionary):
	if _socket.get_ready_state() != WebSocketPeer.STATE_OPEN:
		print ("failed") 
		return 

func play_card ():
	pass 

func slap ():
	pass 

func register_user (username: String, password: String):
	pass 

func login_user (username: String, password: String):
	pass

func create_lobby (): 
	pass 

func join_lobby (game_code: String):
	pass 
	
func leave_lobby ():
	pass 

func _poll_socket ():
	pass
