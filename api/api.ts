export type ClientEvent = 
	| {
		type: "joinRoom"; 
		roomId: roomId; 
	} 
	| {
		type: "leaveRoom"; 
	}
	| {
		type: "playCard"; 
	}
	| {
		type: "slap"; 
	}
	| {
		type: "startGame"; 
	}; 