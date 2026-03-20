extends Node2D


# Exports
@export var loginPopup : Node


# Called when the node enters the scene tree for the first time.
func _ready() -> void:
	# Hide login
	loginPopup.visible = false;


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta: float) -> void:
	pass


func _toggle_login() -> void:
	print("clicked");
	loginPopup.visible = true;
