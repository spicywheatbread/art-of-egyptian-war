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
    // the main socket makes one of these 
    // the last index is the top of the deck 
    // TODO if there's extra cards after dealing, they go into the cetner

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
    centerPile: Card[];
    winnerId: PlayerId | null;
}

export class GameLoop {
    private readonly sessions = new Map<RoomId, GameSession>();

    getSnapshotForRoom(roomId: RoomId, forPlayerId: PlayerId): RoomSnapshotForPlayer | null {
        const session = this.sessions.get(roomId);
        if (!session) {
            return null;
        }

        const publicPlayers = session.players.map((player) => ({
            playerId: player.playerId,
            username: player.username,
        }));

        if (session.status === "Lobby") {
            const lobby: LobbyRoomState = {
                status: "Lobby",
                roomId: session.roomId,
                gameCode: "", 
                hostPlayerId: session.hostPlayerId,
                players: publicPlayers,
                settings: {
                    includeJokers: false,
                    enableTopSlaps: true,
                    enableBottomSlaps: false,
                    burnCardsOnBadSlap: 2,
                    turnTimeLimitMs: null,
                },
                createdAtMs: Date.now(), // TODO
            };

            return {
                public: lobby,
                private: null,
            };
        }

        if (session.status === "gameOver") {
            const gameOver: GameOverRoomState = {
                status: "GameOver",
                roomId: session.roomId,
                players: publicPlayers,
                hostPlayerId: session.hostPlayerId,
                settings: {
                    includeJokers: false,
                    enableTopSlaps: true,
                    enableBottomSlaps: false,
                    burnCardsOnBadSlap: 2,
                    turnTimeLimitMs: null,
                },
                endedAtMs: Date.now(),
                gameStartedAtMs: null,
                finalStats: {
                    winnerPlayerId: session.winnerId,
                    mostSuccessfulSlapsPlayerId: null,
                    leastSlapsPlayerId: null,
                    longestGameInSessionPlayerId: null,
                    players: session.players.map((player) => ({
                        playerId: player.playerId,
                        successfulSlaps: 0,
                        unsuccessfulSlaps: 0,
                        totalSlaps: 0,
                        gamesPlayed: 0,
                        longestGameMs: null,
                    })),
                },
            };

            return {
                public: gameOver,
                private: null,
            };
        }

        const currentPlayer = session.players.find((player) => player.playerId === forPlayerId);
        const publicGame: PublicGameRoomState = {
            status: "InGame",
            roomId: session.roomId,
            players: publicPlayers,
            hostPlayerId: session.hostPlayerId,
            settings: {
                includeJokers: false,
                enableTopSlaps: true,
                enableBottomSlaps: false,
                burnCardsOnBadSlap: 2,
                turnTimeLimitMs: null,
            },
            turn: {
                currentPlayerId: session.players[session.turnIndex]?.playerId ?? null,
                turnStartedAtMs: null,
                turnEndsAtMs: null,
            },
            pileCards: [],
            drawPileRemainingCount: 0,
            burnedCardsOnBadSlapCount: 0,
            gameStartedAtMs: null,
        };

        return {
            public: publicGame,
            private: currentPlayer
                ? {
                      playerId: currentPlayer.playerId,
                      handCards: [...currentPlayer.hand],
                  }
                : null,
        };
    }

    getSnapshotsForRoom(roomId: RoomId): Map<PlayerId, RoomSnapshotForPlayer> | null {
        const session = this.sessions.get(roomId);
        if (!session) {
            return null;
        }

        const snapshots = new Map<PlayerId, RoomSnapshotForPlayer>();
        for (const player of session.players) {
            const snapshot = this.getSnapshotForRoom(roomId, player.playerId);
            if (snapshot) {
                snapshots.set(player.playerId, snapshot);
            }
        }
        return snapshots; // TODO personalize it to each player
    }

    createSessionForLobby (lobby: LobbyRoomState): void {
        this.sessions.set (lobby.roomId, {
            roomId: lobby.roomId,
            hostPlayerId: lobby.hostPlayerId,
            players: lobby.players.map ((player) => ({ ...player, hand: [] })),
            status: "Lobby",
            turnIndex: 0, 
            centerPile: [],
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
    }

    removeRoom (roomId: RoomId): void {
        this.sessions.delete (roomId); 
    }

    startGame (roomId: RoomId, requestedByPlayerId: PlayerId): { ok: boolean; code?: string; message?: string } {
        const s = this.sessions.get (roomId);
        if (!s) return { ok: false, code: "ROOM_NOT_FOUND", message: "Room not found" }; 
        if (s.hostPlayerId != requestedByPlayerId) return { ok: false, code: "HOST_ONLY", message: "Only the host can start the game" }; 
        if (s.players.length < 2) return { ok: false, code: "NOT_ENOUGH_PLAYERS", message: "At least two players are required" }; 
        if (s.status != "Lobby") return { ok: false, code: "GAME_ALREADY_STARTED", message: "Game already started" }; 

        const deck = this.makeAndShuffleDeck (); 
        for (const player of s.players) {
            player.hand = []; 
        }
        deck.forEach ((card: Card, index: number) => {
            s.players[index % s.players.length].hand.push (card);
        }) // TODO this might give people an inequal set of cards 

        s.status = "gameStarted";
        s.turnIndex = 0;
        s.centerPile = [];
        return { ok: true };
    }

    playCard (roomId: RoomId, playerId: PlayerId): { ok: boolean; code?: string; message?: string } {
        const s = this.sessions.get (roomId);
        if (!s) return { ok: false, code: "ROOM_NOT_FOUND", message: "Room not found" };
        if (s.status != "gameStarted") return { ok: false, code: "GAME_NOT_STARTED", message: "Game has not started" };

        const currPlayer = s.players[s.turnIndex]; 
        if (!currPlayer || currPlayer.playerId != playerId) {
            console.warn ("it's not this player's turn"); 
            return { ok: false, code: "NOT_YOUR_TURN", message: "It is not your turn" };
        }

        if (currPlayer.hand.length == 0) {
            return { ok: false, code: "NO_CARDS_LEFT", message: "Player has no cards left" }; // TODO 
        }

        const card = currPlayer.hand.pop()!;
        s.centerPile.push (card);

        this.setNextPlayerIndex (s); 
        this.checkForWin (s); 

        // TODO add the actual card play logic  
        return { ok: true };
    } 

    slap (roomId: RoomId, playerId: PlayerId): { ok: boolean; code?: string; message?: string } {
        const s = this.sessions.get (roomId);
        if (!s) return { ok: false, code: "ROOM_NOT_FOUND", message: "Room not found" };
        if (s.status != "gameStarted") return { ok: false, code: "GAME_NOT_STARTED", message: "Game has not started" };

        const player = s.players.find ((p) => p.playerId == playerId);
        if (!player) return { ok: false, code: "PLAYER_NOT_FOUND", message: "Player not found" };

        const goodSlap = this.isGoodSlap (s); 
        if (goodSlap) {
            player.hand.push (...s.centerPile); 
            s.centerPile = [];
        } 

        this.checkForWin (s);
        return { ok: true };
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
        return s.centerPile.length > 2 && s.centerPile[s.centerPile.length - 1] == s.centerPile[s.centerPile.length - 3]; 
    }

    private checkForWin (s: GameSession): void {
        const winner = s.players.find ((p) => p.hand.length == 52); 
        if (winner) {
            s.status = "gameOver"; 
            s.winnerId = winner.playerId; 
        }
    }
}