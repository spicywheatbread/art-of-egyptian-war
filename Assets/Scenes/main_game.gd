extends Node2D
# TODO delete 
# https://docs.godotengine.org/en/stable/tutorials/networking/websocket.html
@export var websocket_url = "wss://echo.websocket.org" # TODO 
@export var center_pile : Node 

var socket = WebSocketPeer.new() 

# Called when the node enters the scene tree for the first time.
func _ready() -> void:
	var resp = socket.connect_to_url(websocket_url) 
	if resp != OK:
		print ("failed to connect to", websocket_url) 
		return 
	
	# shuffle, actually, should happen on server

# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta: float) -> void:
	
	
	var state = socket.get_ready_state()
	if state == WebSocketPeer.STATE_CLOSED:
		print ("webstocket closed") 
		return 
	socket.poll() 

	while socket.get_available_packet_count():
		var packet = socket.get_packet()
		if socket.was_string_packet():
			var packet_json = JSON.parse_string(packet.get_string_from_utf8()) 
			var event_type = "" # TODO actually get event from json 
			
			if event_type == "playCard":
				pass
			elif event_type == "slap":
				pass
		
	# check if user made a move (maybe check from card) 
	# check if server detected a move, update ui 
	pass



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
