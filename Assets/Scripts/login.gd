extends Node2D


# Exports
@export var popupContainer : Node  
@export var userNameInput : LineEdit
@export var passwordInput : LineEdit 
@export var LoginError : Label 

# Called when the node enters the scene tree for the first time.
func _ready() -> void:
	# Hide login
	popupContainer.visible = false

# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta: float) -> void:
	pass

func _toggle_login() -> void:
	print("kaitlyn clicked");
	popupContainer.visible = true

func _on_close_pressed() -> void:
	popupContainer.visible = false


func _on_login_button_pressed() -> void: 
	LoginError.text = ""
	
	var username = userNameInput.text.strip_edges()
	var password = passwordInput.text.strip_edges()
	if username == "":
		LoginError.text = "Username field is empty."
		return
	if password == "":
		LoginError.text = "Password field is empty."
		return
		
	var msg = await NetworkClient.login_user(username, password)
	if msg:
		LoginError.text = msg


func _on_register_button_pressed() -> void:
	LoginError.text = ""
	
	var username = userNameInput.text.strip_edges()
	var password = passwordInput.text.strip_edges()
	if username == "":
		LoginError.text = "Username field is empty."
		return
	if password == "":
		LoginError.text = "Password field is empty."
		return
		
	var msg = await NetworkClient.register_user(username, password)
	if msg:
		LoginError.text = msg


func _on_forgot_button_pressed() -> void:
	var popup = AcceptDialog.new()
	popup.dialog_text = "too badd" 
	add_child(popup) 
	popup.popup_centered() 


# Auto login on Enter
func _input(event):
	if event is InputEventKey and event.pressed and event.keycode == KEY_ENTER:
		_on_login_button_pressed()
