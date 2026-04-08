extends Node2D


# Exports
@export var popupContainer : Node  
@export var userNameInput : LineEdit
@export var passwordInput : LineEdit 

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

func _on_submit_button_pressed() -> void: 
	var username = userNameInput.text.strip_edges()
	var password = passwordInput.text.strip_edges()
	if username == null:
		print ("username is null.. ")
		return
	if password == null:
		print ("password is null.. ")
		return
		
	var login_data = {
		"username" : username, 
		"password" : password 
	}
	
	print (JSON.stringify(login_data)) # TODO actually do something with this 
	
func _on_forgot_button_pressed() -> void:
	var popup = AcceptDialog.new()
	popup.dialog_text = "too badd" 
	add_child(popup) 
	popup.popup_centered() 
