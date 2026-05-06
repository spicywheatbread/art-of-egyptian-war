extends Node2D


@onready var chat_options = $ChatOptions


# Called when the node enters the scene tree for the first time.
func _ready() -> void:
	chat_options.hide()


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta: float) -> void:
	pass


func hide_chat_toggle() -> void:
	$ChatToggle.visible = false


func show_chat_toggle() -> void:
	$ChatToggle.visible = true


func _on_chat_toggle_pressed() -> void:
	chat_options.visible = !chat_options.visible


func _on_emoji_1_gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
			NetworkClient.send_chat(1)


func _on_emoji_2_gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
			NetworkClient.send_chat(2)

func _on_emoji_3_gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
			NetworkClient.send_chat(3)


func _on_emoji_4_gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
			NetworkClient.send_chat(4)


func hide_all_display_emojis():
	for i in range(1, 5):
		get_node("ChatDisplay%d" % i).visible = false


func display_emoji(emoji_number : int):
	# Hide all emojis first
	hide_all_display_emojis()
	
	var emoji = get_node("ChatDisplay%d" % emoji_number)
	emoji.visible = true
	$Timer.start()


func _on_timer_timeout() -> void:
	hide_all_display_emojis()
