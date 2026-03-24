extends Node2D


@export var quote : Node


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
	# Choose random quote
	var random_int = randi() % quotes.size()
	quote.text = quotes[random_int].to_upper()


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta: float) -> void:
	pass
