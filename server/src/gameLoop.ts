
// wait for a dealer to start the game
// accept the players that join the game until dealer starts the game. 

// establish player order
    // broadcast that 

// shuffle, deal all cards evenly (face down) 

// wait for the relevant player to play (flip or slap) 
// validate the play 

	// if flip: 
	// check if they must flip a royal card within their move 
		// (if they fail to flip a royal card in time, give the stack to the previous player) 

    // (player flips up a card in middle of table)
        // if card is number from 2-10, nothing happens, 
        // if card is A J Q K, next player has: 
            // A: 4 chances to flip a royal card
            // K: 3 chances to flip a royal card
            // Q: 2 chances to flip a royal card
            // J: 1 chance to flip a royal card 
    // broadcast their play, if valid 

	// if slap: 
	// check if they slapped a sandwich, and the later slaps in the queue are discarded
	// broadcast their play, if valid 

// if someone won (has all the cards in their hand), broadcast gameOver and winner 
// save the game results to db? (possibly do that per turn?) TODO 



