# The Art of Egyptian War

The Art of Egyptian War will be a digital adaptation of the casual card game “Egyptian War”. Our game aims to be an easily accessible alternative to the real world game with additional mechanics. Because our game is online, people are able to play Egyptian War even if they are not in the same location.

## Rules of the Game
2-4 players

The **goal** of the game is to have the whole deck (last player standing).
The cards are dealt between all players evenly. Players do not get to look at their cards. One player starts and places down a card. Players go counterclockwise and each place down a card.
Players may slap the deck if the top card is as follows:
- The same number as the card below the one below it (ex: 5♣ 6♠ 5♠)
- The same number as the card directly below it

The player who slaps the deck first wins the played cards, and without shuffling, places it at the bottom of their own deck and begins the next deck by playing a card
If a player slaps a deck that is not valid, they must place one or two cards as penalty (“burn”) under the played deck of cards (this changes the number at the bottom of the deck)
If the following are played then:
- A: The following player must play 4 cards
- K: The following player must play 3 cards
- Q: The following player must play 2 cards
- J: The following player must play 1 card

If the following player plays another special card, the next person's turn starts accordingly. 
If the player plays only numerical cards, the person who played the AKQJ wins the deck. 
If the player runs out of cards, the person who played the AKQJ wins the deck automatically. 

If a player loses all cards, they may forfeit or try to get back in the game by slapping the deck correctly.

## Tech Stack

Godot
- This contains a main network client class, which follows the singleton design pattern loaded at start and has all the functionality for sending and receiving messages to and from the server

Node.js Server
- We are using Firebase for authentication
- Our primary setup is in the GameManager class to manage each game lobby and synchornizes the game state when players take action

We are using websockets to exchange information between Godot and the Node.js server.

