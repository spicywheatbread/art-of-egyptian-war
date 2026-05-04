import {
    Rank,
    Suit,
    type Card,
    type GameOverRoomState,
    type GameSettings,
    type LobbyRoomState,
    type PlayerId,
    type PublicGameRoomState,
    type RoomId,
    type RoomSnapshotForPlayer,
    type InGamePlayer,
    type LastActionEvent,
    MAX_PLAYERS_PER_GAME,
    MIN_PLAYERS_PER_GAME,
} from "./protocol";

// ASSUMPTIONS
// the main socket makes one of these
// the last index is the top of the deck
// TODO if there's extra cards after dealing, they go into the cetner
// TODO seems like this conflicts with the existing lobby stuff 


interface GameSession {
    roomId: RoomId;
    hostPlayerId: PlayerId;
    settings: GameSettings;
    players: InGamePlayer[];
    status: "Lobby" | "gameStarted" | "gameOver"; 
    turnIndex: number; 
    centerPile: Card[];
    burnedCardsOnBadSlapCount: number;
    winnerId: PlayerId | null;
    remainingChancesToFlipRoyal: number; // -1 if N/A 
    royalWinnerTurnIndex: number | null; // index of the player who played the royal card, or null if N/A
    lastAction?: LastActionEvent;
}

export class GameLoop {
    private readonly rankToChances: Record<Rank, number> = {
        [Rank.JACK]: 1,
        [Rank.QUEEN]: 2,
        [Rank.KING]: 3,
        [Rank.ACE]: 4,
        [Rank.TWO]: 0, // ug i had to add this to make the error go away 
        [Rank.THREE]: 0,
        [Rank.FOUR]: 0,
        [Rank.FIVE]: 0,
        [Rank.SIX]: 0,
        [Rank.SEVEN]: 0,
        [Rank.EIGHT]: 0,
        [Rank.NINE]: 0,
        [Rank.TEN]: 0
    };
    private readonly sessions = new Map<RoomId, GameSession>();

    getSnapshotForRoom(roomId: RoomId, forPlayerId: PlayerId): RoomSnapshotForPlayer | null {
        const session = this.sessions.get(roomId);
        if (!session) {
            return null;
        }
        const playerProfiles = session.players.map((player) => ({
            playerId: player.playerId,
            username: player.username,
        }));

        if (session.status === "Lobby") {
            const lobby: LobbyRoomState = {
                status: "Lobby",
                roomId: session.roomId,
                gameCode: "", 
                hostPlayerId: session.hostPlayerId,
                players: playerProfiles,
                settings: session.settings,
                createdAtMs: Date.now(), // TODO
            };

            return {
                public: lobby,
            };
        }

        if (session.status === "gameOver") {
            const gameOver: GameOverRoomState = {
                status: "GameOver",
                roomId: session.roomId,
                players: playerProfiles,
                hostPlayerId: session.hostPlayerId,
                settings: session.settings,
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
            };
        }

        const publicPlayers = session.players.map((player) => ({
            playerId: player.playerId,
            username: player.username,
            hand_count: player.hand.length
        }));

        const publicGame: PublicGameRoomState = {
            status: "InGame",
            roomId: session.roomId,
            players: publicPlayers,
            hostPlayerId: session.hostPlayerId,
            settings: session.settings,
            turn: {
                currentPlayerId: session.players[session.turnIndex]?.playerId ?? null,
                turnStartedAtMs: null,
                turnEndsAtMs: null,
            },
            pileCards: session.centerPile,
            pileTopCard:
                session.centerPile.length > 0
                    ? session.centerPile[session.centerPile.length - 1]
                    : undefined,
            pileBottomCard: session.centerPile.length > 0 ? session.centerPile[0] : undefined,
            drawPileRemainingCount: session.players.reduce((n, p) => n + p.hand.length, 0),
            burnedCardsOnBadSlapCount: session.burnedCardsOnBadSlapCount,
            gameStartedAtMs: null,
            remainingChancesToFlipRoyal: session.remainingChancesToFlipRoyal,
            lastAction: session.lastAction
        };

        return {
            public: publicGame,
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
            settings: lobby.settings,
            players: lobby.players.map ((player) => ({ ...player, hand: [] })),
            status: "Lobby",
            turnIndex: 0, 
            centerPile: [],
            burnedCardsOnBadSlapCount: 0,
            winnerId: null,
            remainingChancesToFlipRoyal: -1,
            royalWinnerTurnIndex: null,
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
        s.settings = lobby.settings;
    }

    removeRoom (roomId: RoomId): void {
        this.sessions.delete (roomId); 
    }

    startGame (roomId: RoomId, requestedByPlayerId: PlayerId): { ok: boolean; code?: string; message?: string } {
        const s = this.sessions.get (roomId);
        if (!s) return { ok: false, code: "ROOM_NOT_FOUND", message: "Room not found" }; 
        if (s.hostPlayerId != requestedByPlayerId) return { ok: false, code: "HOST_ONLY", message: "Only the host can start the game" }; 
        if (s.players.length < MIN_PLAYERS_PER_GAME) {
            return {
                ok: false,
                code: "NOT_ENOUGH_PLAYERS",
                message: `At least ${MIN_PLAYERS_PER_GAME} players are required`,
            };
        }
        if (s.players.length > s.settings.maxPlayers || s.players.length > MAX_PLAYERS_PER_GAME) {
            return {
                ok: false,
                code: "TOO_MANY_PLAYERS",
                message: `A game can have at most ${MAX_PLAYERS_PER_GAME} players`,
            };
        }
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
        s.burnedCardsOnBadSlapCount = 0;
        s.royalWinnerTurnIndex = null;
        s.lastAction = {
            "type": "startGame",
            "atMs": Date.now(),
            "byPlayerId": requestedByPlayerId
        }
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

        if (card.rank >= Rank.JACK || card.rank == Rank.ACE) {
            s.remainingChancesToFlipRoyal = this.rankToChances[card.rank];
            s.royalWinnerTurnIndex = s.turnIndex;
            this.setNextPlayerIndex (s); 
        } else if (s.remainingChancesToFlipRoyal > 0) {
            s.remainingChancesToFlipRoyal -= 1;

            if (currPlayer.hand.length == 0) {
                s.remainingChancesToFlipRoyal = 0;
            }

            if (s.remainingChancesToFlipRoyal == 0) {
                if (s.royalWinnerTurnIndex !== null) {
                    s.players[s.royalWinnerTurnIndex].hand.unshift (...s.centerPile);
                } else {
                    // Default to previous player if for some reason royalWinnerTurnIndex is null
                    if (s.turnIndex == 0) {
                        s.players[s.players.length - 1].hand.unshift (...s.centerPile); 
                    } else {
                        s.players [s.turnIndex -1].hand.unshift (...s.centerPile); 
                    }
                }
                s.centerPile = [];
                s.turnIndex = s.royalWinnerTurnIndex !== null ? s.royalWinnerTurnIndex : s.turnIndex;
            }
        } else {
            this.setNextPlayerIndex (s); 
        }

        s.lastAction = {
            "type": "playCard",
            "atMs": Date.now(),
            "byPlayerId": playerId,
            "card": card
        }
        this.checkForWin (s); 
        return { ok: true };
    } 

    slap (roomId: RoomId, playerId: PlayerId): { ok: boolean; code?: string; message?: string } {
        const s = this.sessions.get (roomId);
        if (!s) return { ok: false, code: "ROOM_NOT_FOUND", message: "Room not found" };
        if (s.status != "gameStarted") return { ok: false, code: "GAME_NOT_STARTED", message: "Game has not started" };

        const player = s.players.find ((p) => p.playerId == playerId);
        if (!player) return { ok: false, code: "PLAYER_NOT_FOUND", message: "Player not found" };

        if (s.centerPile.length == 0) {
            return { ok: false, code: "NO_CARDS_IN_PILE", message: "There are no cards in the center pile to slap" };
        }

        const goodSlap = this.isGoodSlap (s); 
        let burnedCount = 0;
        if (goodSlap) {
            player.hand.unshift(...s.centerPile);
            s.centerPile = [];
            // Reset
            s.remainingChancesToFlipRoyal = -1;
            // The player who won the slap goes next
            const winnerIndex = s.players.findIndex((p) => p.playerId === playerId);
            if (winnerIndex !== -1) {
                s.turnIndex = winnerIndex;
            }
        } else {
            const requestedBurnCount =
                s.settings.burnCardsOnBadSlap === "ENTIRE_HAND"
                    ? player.hand.length
                    : s.settings.burnCardsOnBadSlap;
            burnedCount = this.burnFromPlayerToCenterBottom(s, player, requestedBurnCount);
        } 

        s.lastAction = {
            "type": "slap",
            "atMs": Date.now(),
            "byPlayerId": playerId,
            "wasSuccessful": goodSlap,
            "burnedCount": burnedCount,
        }
        this.checkForWin (s);
        return { ok: true };
    } 

    private makeAndShuffleDeck (): Card[] {
        const deck = [] as Card[];
        const suits = Object.values(Suit).filter((v): v is Suit => typeof v === "number");
        const ranks = Object.values(Rank).filter((v): v is Rank => typeof v === "number");
        for (const s of suits) {
            for (const r of ranks) {
                deck.push({ suit: s, rank: r });
            }
        }

        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor (Math.random() * (i +1)); 
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck; 
    }

    private setNextPlayerIndex (s: GameSession): void {
        // Set next player index in a circular manner and skip over those with zero cards
        s.turnIndex = (s.turnIndex + 1) % s.players.length;
        while (s.players[s.turnIndex].hand.length == 0) {
            s.turnIndex = (s.turnIndex + 1) % s.players.length;
        }
    }

    private setPreviousPlayerIndex (s: GameSession): void {
        s.turnIndex = s.turnIndex == 0 ? s.players.length - 1 : s.turnIndex - 1;
        while (s.players[s.turnIndex].hand.length == 0) {
            s.turnIndex = s.turnIndex == 0 ? s.players.length - 1 : s.turnIndex - 1;
        }
    }

    private isGoodSlap (s: GameSession): boolean {
        return (this.isPair(s) || this.isSandwich(s));
    }

    private isPair (s: GameSession): boolean {
        return s.centerPile.length >= 2 && s.centerPile[s.centerPile.length - 1].rank == s.centerPile[s.centerPile.length - 2].rank;
    }

    private isSandwich (s: GameSession): boolean {
        return s.centerPile.length >= 3 && s.centerPile[s.centerPile.length - 1].rank == s.centerPile[s.centerPile.length - 3].rank;
    }

    private burnFromPlayerToCenterBottom(s: GameSession, player: InGamePlayer, requestedCount: number): number {
        const count = Math.max(0, Math.min(requestedCount, player.hand.length));
        if (count === 0) {
            return 0;
        }

        const burned: Card[] = [];
        for (let i = 0; i < count; i++) {
            const c = player.hand.pop();
            if (!c) break;
            burned.push(c);
        }

        if (burned.length > 0) {
            // Bottom of center pile is index 0.
            // We must keep pop() order so the first burned card becomes the true bottom-most card.
            s.centerPile.unshift(...burned);
            s.burnedCardsOnBadSlapCount += burned.length;
        }

        return burned.length;
    }

    private checkForWin (s: GameSession): void {
        // Check if only one player remaining
        if (s.players.length == 1) {
            s.status = "gameOver";
            s.winnerId = s.players[0].playerId;
            return;
        }

        // Check if one player is the only one holding cards
        const playersWithCards = s.players.filter((p) => p.hand.length > 0);
        if (playersWithCards.length == 1) {
            s.status = "gameOver";
            s.winnerId = playersWithCards[0].playerId;
            return;
        }

        // Check if one player has all the cards
        const winner = s.players.find ((p) => p.hand.length == 52); 
        if (winner) {
            s.status = "gameOver"; 
            s.winnerId = winner.playerId; 
        }
    }
}
