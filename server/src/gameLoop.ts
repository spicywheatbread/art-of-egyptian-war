import { parseClientMessage, ParseError } from "./lobby/messages";
import { LobbyStore } from "./lobby/store";
import {
    Rank,
    Suit,
    type Card,
    type GameOverRoomState,
    type GameStatistics,
    type LastActionEvent,
    type LobbyRoomState,
    type PlayerId,
    type PrivatePlayerState,
    type PublicGameRoomState,
    type RoomId,
    type RoomSnapshotForPlayer,
    type UserProfile,
} from "./protocol";

// ASSUMPTIONS 
    // all of this happens on createLobby 
    // players use a code to join the game. 

var gameStarted = false; 
var dealer_user = ""; 
var deck = [] as Card[]; // the shuffled deck 
var curr_player_index = 0; 

interface InGamePlayer extends UserProfile {
    hand: Card[];
}
var players = [] as InGamePlayer[];

interface GameSession {
    roomId: RoomId;
    hostPlayerId: PlayerId;
    players: InGamePlayer[];
    status: "Lobby" | "gameStarted" | "gameOver"; 
    turnIndex: number; 
    deck: Card[];
    winnerId: PlayerId | null;
}

// wait for a dealer to start the game
// accept the players that join the game until dealer starts the game. 

// socket.on ("message", async (message) => {
export class GameLoop {
    private readonly sessions = new Map<RoomId, GameSession>();

    createSessionForLobby (lobby: LobbyRoomState): void {
        this.sessions.set (lobby.roomId, {
            roomId: lobby.roomId,
            hostPlayerId: lobby.hostPlayerId,
            players: lobby.players.map ((player) => ({ ...player, hand: [] })),
            status: "Lobby",
            turnIndex: 0, 
            deck: [],
            winnerId: null,
        })
    }

    updateLobbyPlayers (lobby: LobbyRoomState): void {
        const s = this.sessions.get (lobby.roomId); 
        if (!s) {
            this.createSessionForLobby (lobby); 
            return; 
        }
        if (s.status != "Lobby") {
            console.warn ("ignoring lobby update for not-lobby state"); 
            return; 
        } 

        s.players = lobby.players.map ((player) => ({...player, hand: []})); 
        // TODO give them their hand, maype validate turn index

    }

    removeRoom (roomId: RoomId): void {
        this.sessions.delete (roomId); 
    }

    startGame (roomId: RoomId, requestedByPlayerId: PlayerId): void {
        const s = this.sessions.get (roomId);
        if (!s) return; // TODO 
        if (s.hostPlayerId != requestedByPlayerId) return; // TODO
        if (s.players.length < 2) return; // TODO
        if (s.status != "Lobby") return; // TODO

        const deck = this.makeAndShuffleDeck (); 
        for (const player of s.players) {
            player.hand = []; 
        }
        deck.forEach ((card: Card, index: number) => {
            s.players[index % s.players.length].hand.push (card);
        })

        s.status = "gameStarted";
        s.turnIndex = 0;
        // s.pileCards = []; 
        
    }

    playCard (roomId: RoomId, playerId: PlayerId): void {
        const s = this.sessions.get (roomId);
        if (!s) return;
        if (s.status != "gameStarted") return;

        const currPlayer = s.players[s.turnIndex]; 
        if (!currPlayer || currPlayer.playerId != playerId) {
            console.warn ("it's not this player's turn"); 
            return;
        }

        if (currPlayer.hand.length == 0) {
            return; // TODO 
        }

        const card = currPlayer.hand.pop()!;
        // this.sessions.pileCards.push (card); TODO forgot to add the pile 

        this.setNextPlayerIndex (s); 
        this.checkForWin (s); 

        // TODO add the actual card play logic  
    } 

    slap (roomId: RoomId, playerId: PlayerId): void {
        const s = this.sessions.get (roomId);
        if (!s) return;
        if (s.status != "gameStarted") return;

        const player = s.players.find ((p) => p.playerId == playerId);
        if (!player) return;

        const goodSlap = this.isGoodSlap (s); 
        if (goodSlap) {
            // give that player the pile 
        } 

        this.checkForWin (s);
    } 

    private makeAndShuffleDeck (): Card[] {
        const deck = [] as Card[];
        for (const s of Object.values(Suit)) {
            for (const r of Object.values(Rank)) {
                deck.push({ suit: s, rank: r } as Card);
            }
        } 

        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor (Math.random() * (i +1)); 
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck; 
    }

    private setNextPlayerIndex (s: GameSession): void {
        s.turnIndex = (s.turnIndex + 1) % s.players.length; 
    }

    private isGoodSlap (s: GameSession): boolean {
        // TODO add actual slap logic 
        return false; 
    }

    private checkForWin (s: GameSession): void {
        const winner = s.players.find ((p) => p.hand.length == 52); 
        if (winner) {
            s.status = "gameOver"; 
            s.winnerId = winner.playerId; 
        }
    }
}