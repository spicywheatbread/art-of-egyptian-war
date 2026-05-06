extends Node2D

@export var QuoteDisplay : Node
@export var HostConfirmGame : Node
@export var JoinConfirmGame : Node
@export var Profile : Node
@export var WelcomeMessage : Node
@export var StatsDisplay : Node
@export var JoinCodeInput : Node
@export var InvalidCodeMessage : Node


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
	InvalidCodeMessage.visible = false
	
	# Choose random quote
	var random_int = randi() % quotes.size()
	QuoteDisplay.text = quotes[random_int].to_upper()

	# Display welcome and stats on start
	var stats = await NetworkClient.get_stats()
	print(JSON.stringify(stats, "\t"))
	WelcomeMessage.text = "WELCOME,\n" + stats["username"].to_upper() + "!"
	StatsDisplay.text = "GAMES PLAYED: " + str(int(stats["gamesPlayed"])) + "\n\nGAMES WON: " + str(int(stats["wins"]))


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta: float) -> void:
	pass


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
	NetworkClient.create_lobby()
	
func _on_join_game_confirm_button_pressed() -> void:
	if len(JoinCodeInput.text) != 4:
		InvalidCodeMessage.visible = true
		return
		
	InvalidCodeMessage.visible = false
	var success = await NetworkClient.join_lobby(JoinCodeInput.text)
	if !success:
		InvalidCodeMessage.visible = true


# Auto join on Enter
func _input(event):
	if event is InputEventKey and event.pressed and event.keycode == KEY_ENTER:
		_on_join_game_confirm_button_pressed()
