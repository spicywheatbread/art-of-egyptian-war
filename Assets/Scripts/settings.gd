extends Node2D


@export var SettingsPopup : Node
@export var ColorPickerPreview : Button
@export var ColorPickerPopup : Node
@export var VolumeSlider : HSlider


signal settings_changed(color: Color, volume: int)


# Called when the node enters the scene tree for the first time.
func _ready() -> void:
	SettingsPopup.visible = false

func _on_settings_button_pressed() -> void:
	SettingsPopup.visible = true
	ColorPickerPopup.visible = false

func _on_close_popup_pressed() -> void:
	SettingsPopup.visible = false


func _on_color_picker_button_pressed() -> void:
	ColorPickerPopup.visible = true

func _on_close_color_popup_pressed() -> void:
	ColorPickerPopup.visible = false


func _on_color_picker_color_changed(color: Color) -> void:
	var stylebox: StyleBox = ColorPickerPreview.get_theme_stylebox("normal")
	stylebox.bg_color = color
	ColorPickerPreview.add_theme_stylebox_override("normal", stylebox)


func _on_apply_button_pressed() -> void:
	_on_close_popup_pressed()
	# Emit signal to parent
	settings_changed.emit(ColorPickerPreview.get_theme_stylebox("normal").bg_color, VolumeSlider.value)
