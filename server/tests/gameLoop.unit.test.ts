import { randomUUID } from "crypto";
import { describe, expect, it, vi } from "vitest";
import { GameLoop } from "../src/gameLoop";
import { LobbyStore } from "../src/lobby/store";
import type { Card, LobbyRoomState, PlayerId, RoomId } from "../src/protocol";
import { defaultGameSettings, Rank, Suit } from "../src/protocol";
import { createMultiPlayerLobbyWithGameLoop } from "./helpers/multiPlayerLobby";
import { createTwoPlayerLobbyWithGameLoop, mockSocket } from "./helpers/twoPlayerLobby";

/** Narrow view of internal session for tests only (GameLoop keeps sessions private). */
interface TestSession {
  status: "Lobby" | "gameStarted" | "gameOver";
  turnIndex: number;
  centerPile: Card[];
  players: { playerId: PlayerId; hand: Card[]; username: string }[];
  winnerId: PlayerId | null;
  remainingChancesToFlipRoyal: number;
  burnedCardsOnBadSlapCount: number;
  settings: { burnCardsOnBadSlap: number | "ENTIRE_HAND" };
}

function getTestSession(gameLoop: GameLoop, roomId: RoomId): TestSession | undefined {
  const sessions = (gameLoop as unknown as { sessions: Map<RoomId, TestSession> }).sessions;
  return sessions.get(roomId);
}

function totalCardsInHands(session: TestSession): number {
  return session.players.reduce((n, p) => n + p.hand.length, 0);
}

function card(rank: Rank, suit: Suit = Suit.SPADES): Card {
  return { suit, rank };
}

describe("GameLoop", () => {
  describe("session lifecycle", () => {
    it("createSessionForLobby exposes lobby snapshot with matching players", () => {
      const { gameLoop, lobby, roomId, hostPlayerId } = createTwoPlayerLobbyWithGameLoop();
      const snap = gameLoop.getSnapshotForRoom(roomId, hostPlayerId);
      expect(snap).not.toBeNull();
      if (!snap) throw new Error("expected snapshot");
      expect(snap.public.status).toBe("Lobby");
      if (snap.public.status !== "Lobby") throw new Error("expected Lobby");
      expect(snap.public.players.map((p) => p.username)).toEqual(["Alice", "Bob"]);
    });

    it("updateLobbyPlayers replaces players in Lobby state", () => {
      const { gameLoop, lobby, roomId, hostPlayerId } = createTwoPlayerLobbyWithGameLoop();
      const daveId = randomUUID() as PlayerId;
      const updated: LobbyRoomState = {
        status: "Lobby",
        roomId: lobby.roomId,
        gameCode: lobby.gameCode,
        hostPlayerId: lobby.hostPlayerId,
        players: [
          { playerId: hostPlayerId, username: "Alice" },
          { playerId: daveId, username: "Dave" },
        ],
        settings: defaultGameSettings(),
        createdAtMs: lobby.createdAtMs,
      };
      gameLoop.updateLobbyPlayers(updated);
      const snap = gameLoop.getSnapshotForRoom(roomId, hostPlayerId);
      expect(snap?.public.status).toBe("Lobby");
      if (snap?.public.status !== "Lobby") return;
      expect(snap.public.players.map((p) => p.username)).toEqual(["Alice", "Dave"]);
    });

    it("updateLobbyPlayers creates session when missing", () => {
      const store = new LobbyStore();
      const hostSocket = mockSocket();
      const lobby = store.createRoom(hostSocket, "Solo");
      const gameLoop = new GameLoop();
      gameLoop.updateLobbyPlayers(lobby);
      expect(gameLoop.getSnapshotForRoom(lobby.roomId, lobby.hostPlayerId)).not.toBeNull();
    });

    it("updateLobbyPlayers ignores updates when not in Lobby and warns", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { gameLoop, lobby, roomId, hostPlayerId } = createTwoPlayerLobbyWithGameLoop();
      expect(gameLoop.startGame(roomId, hostPlayerId).ok).toBe(true);
      const totalBefore = totalCardsInHands(getTestSession(gameLoop, roomId)!);

      gameLoop.updateLobbyPlayers(lobby);

      expect(warn).toHaveBeenCalled();
      expect(totalCardsInHands(getTestSession(gameLoop, roomId)!)).toBe(totalBefore);
      warn.mockRestore();
    });

    it("removeRoom drops the session", () => {
      const { gameLoop, roomId, hostPlayerId } = createTwoPlayerLobbyWithGameLoop();
      gameLoop.removeRoom(roomId);
      expect(gameLoop.getSnapshotForRoom(roomId, hostPlayerId)).toBeNull();
    });

    it("returns ROOM_NOT_FOUND for unknown room", () => {
      const gameLoop = new GameLoop();
      const fakeRoom = "00000000-0000-0000-0000-000000000001" as RoomId;
      const fakePlayer = "00000000-0000-0000-0000-000000000002" as PlayerId;
      expect(gameLoop.startGame(fakeRoom, fakePlayer).code).toBe("ROOM_NOT_FOUND");
      expect(gameLoop.playCard(fakeRoom, fakePlayer).code).toBe("ROOM_NOT_FOUND");
      expect(gameLoop.slap(fakeRoom, fakePlayer).code).toBe("ROOM_NOT_FOUND");
    });
  });

  describe("startGame", () => {
    it("deals 52 cards across players and transitions to InGame", () => {
      const { gameLoop, roomId, hostPlayerId } = createTwoPlayerLobbyWithGameLoop();
      expect(gameLoop.startGame(roomId, hostPlayerId).ok).toBe(true);

      const session = getTestSession(gameLoop, roomId)!;
      expect(session.status).toBe("gameStarted");
      expect(totalCardsInHands(session)).toBe(52);
      expect(session.players[0].hand.length + session.players[1].hand.length).toBe(52);

      const snap = gameLoop.getSnapshotForRoom(roomId, hostPlayerId);
      expect(snap?.public.status).toBe("InGame");
      if (snap?.public.status !== "InGame") throw new Error("expected InGame");
      expect(snap.public.players[0].hand_count).toBe(26);
    });

    it("rejects non-host", () => {
      const { gameLoop, roomId, guestPlayerId } = createTwoPlayerLobbyWithGameLoop();
      const r = gameLoop.startGame(roomId, guestPlayerId);
      expect(r.ok).toBe(false);
      expect(r.code).toBe("HOST_ONLY");
    });

    it("rejects fewer than two players", () => {
      const store = new LobbyStore();
      const gameLoop = new GameLoop();
      const lobby = store.createRoom(mockSocket(), "Only");
      gameLoop.createSessionForLobby(lobby);
      const r = gameLoop.startGame(lobby.roomId, lobby.hostPlayerId);
      expect(r.ok).toBe(false);
      expect(r.code).toBe("NOT_ENOUGH_PLAYERS");
    });

    it("rejects start when game already started", () => {
      const { gameLoop, roomId, hostPlayerId } = createTwoPlayerLobbyWithGameLoop();
      expect(gameLoop.startGame(roomId, hostPlayerId).ok).toBe(true);
      const r = gameLoop.startGame(roomId, hostPlayerId);
      expect(r.ok).toBe(false);
      expect(r.code).toBe("GAME_ALREADY_STARTED");
    });

    it("deals 52 cards across 3 players", () => {
      const { gameLoop, roomId, hostPlayerId } = createMultiPlayerLobbyWithGameLoop([
        "A",
        "B",
        "C",
      ]);
      expect(gameLoop.startGame(roomId, hostPlayerId).ok).toBe(true);
      const session = getTestSession(gameLoop, roomId)!;
      expect(totalCardsInHands(session)).toBe(52);
    });

    it("deals 52 cards across 4 players (13 each)", () => {
      const { gameLoop, roomId, hostPlayerId } = createMultiPlayerLobbyWithGameLoop([
        "A",
        "B",
        "C",
        "D",
      ]);
      expect(gameLoop.startGame(roomId, hostPlayerId).ok).toBe(true);
      const session = getTestSession(gameLoop, roomId)!;
      expect(totalCardsInHands(session)).toBe(52);
      expect(session.players.every((p) => p.hand.length === 13)).toBe(true);
    });

    it("rejects start with more than four players", () => {
      const { gameLoop, lobby, roomId, hostPlayerId } = createTwoPlayerLobbyWithGameLoop();
      const extra = [1, 2, 3].map((n) => ({
        playerId: randomUUID() as PlayerId,
        username: `Extra${n}`,
      }));
      const overloaded: LobbyRoomState = {
        ...lobby,
        players: [...lobby.players, ...extra],
      };
      gameLoop.updateLobbyPlayers(overloaded);
      const r = gameLoop.startGame(roomId, hostPlayerId);
      expect(r.ok).toBe(false);
      expect(r.code).toBe("TOO_MANY_PLAYERS");
    });
  });

  describe("getSnapshotForRoom / getSnapshotsForRoom", () => {
    /* 

    Why would we send each player only their own hand? You're not supposed to know your own hand in egyptian war, just your hand count.
    Also, how would the game view know how many cards to draw for the other players? 

    it("sends each player only their own hand in InGame", () => {
      const { gameLoop, roomId, hostPlayerId, guestPlayerId } = createTwoPlayerLobbyWithGameLoop();
      gameLoop.startGame(roomId, hostPlayerId);

      const hostSnap = gameLoop.getSnapshotForRoom(roomId, hostPlayerId);
      const guestSnap = gameLoop.getSnapshotForRoom(roomId, guestPlayerId);
      if (hostSnap?.public.status !== "InGame" || guestSnap?.public.status !== "InGame") {
        throw new Error("expected InGame");
      }

      expect(hostSnap.private?.playerId).toBe(hostPlayerId);
      expect(guestSnap.private?.playerId).toBe(guestPlayerId);
      expect(hostSnap.private?.handCards).not.toEqual(guestSnap.private?.handCards);
    });
    */

    it("getSnapshotsForRoom returns one entry per player", () => {
      const { gameLoop, roomId, hostPlayerId, guestPlayerId } = createTwoPlayerLobbyWithGameLoop();
      gameLoop.startGame(roomId, hostPlayerId);
      const map = gameLoop.getSnapshotsForRoom(roomId);
      expect(map).not.toBeNull();
      expect(map!.size).toBe(2);
      expect(map!.has(hostPlayerId)).toBe(true);
      expect(map!.has(guestPlayerId)).toBe(true);
    });

    it("getSnapshotsForRoom includes four players in a four-player lobby", () => {
      const { gameLoop, roomId, hostPlayerId, playerIds } = createMultiPlayerLobbyWithGameLoop([
        "A",
        "B",
        "C",
        "D",
      ]);
      gameLoop.startGame(roomId, hostPlayerId);
      const map = gameLoop.getSnapshotsForRoom(roomId);
      expect(map?.size).toBe(4);
      for (const id of playerIds) {
        expect(map?.has(id)).toBe(true);
      }
    });
  });

  describe("playCard", () => {
    it("rejects when game not started", () => {
      const { gameLoop, roomId, hostPlayerId } = createTwoPlayerLobbyWithGameLoop();
      expect(gameLoop.playCard(roomId, hostPlayerId).code).toBe("GAME_NOT_STARTED");
    });

    it("rejects wrong player", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { gameLoop, roomId, hostPlayerId, guestPlayerId } = createTwoPlayerLobbyWithGameLoop();
      gameLoop.startGame(roomId, hostPlayerId);
      expect(gameLoop.playCard(roomId, guestPlayerId).code).toBe("NOT_YOUR_TURN");
      warn.mockRestore();
    });

    it("playing a royal sets chances and advances turn", () => {
      const { gameLoop, roomId, hostPlayerId, guestPlayerId } = createTwoPlayerLobbyWithGameLoop();
      gameLoop.startGame(roomId, hostPlayerId);
      const session = getTestSession(gameLoop, roomId)!;
      session.players[0].hand = [card(Rank.JACK)];
      session.players[1].hand = [];
      session.centerPile = [];
      session.remainingChancesToFlipRoyal = -1;
      session.turnIndex = 0;

      expect(gameLoop.playCard(roomId, hostPlayerId).ok).toBe(true);
      expect(session.remainingChancesToFlipRoyal).toBe(1);
      expect(session.turnIndex).toBe(1);

      const snap = gameLoop.getSnapshotForRoom(roomId, guestPlayerId);
      if (snap?.public.status !== "InGame") throw new Error("expected InGame");
      expect(snap.public.turn.currentPlayerId).toBe(guestPlayerId);
    });

    it("decrements royal chances on non-royal during challenge", () => {
      const { gameLoop, roomId, hostPlayerId, guestPlayerId } = createTwoPlayerLobbyWithGameLoop();
      gameLoop.startGame(roomId, hostPlayerId);
      const session = getTestSession(gameLoop, roomId)!;
      session.turnIndex = 1;
      session.remainingChancesToFlipRoyal = 1;
      session.centerPile = [card(Rank.TEN)];
      session.players[1].hand = [card(Rank.FOUR)];

      expect(gameLoop.playCard(roomId, guestPlayerId).ok).toBe(true);
      expect(session.remainingChancesToFlipRoyal).toBe(0);
      expect(session.centerPile.length).toBe(2);
    });

    it("when chances are 0 at play start, previous player takes center pile", () => {
      const { gameLoop, roomId, hostPlayerId, guestPlayerId } = createTwoPlayerLobbyWithGameLoop();
      gameLoop.startGame(roomId, hostPlayerId);
      const session = getTestSession(gameLoop, roomId)!;
      const extra = card(Rank.SIX);
      session.centerPile = [card(Rank.TWO), card(Rank.THREE), extra];
      session.players[0].hand = [card(Rank.FIVE)];
      session.players[1].hand = [card(Rank.SEVEN)];
      session.turnIndex = 1;
      session.remainingChancesToFlipRoyal = 0;

      const hostHandBefore = session.players[0].hand.length;

      expect(gameLoop.playCard(roomId, guestPlayerId).ok).toBe(true);
      expect(session.players[0].hand.length).toBe(hostHandBefore + 3);
      expect(session.centerPile).toHaveLength(1);
    });

    it("rejects play with empty hand", () => {
      const { gameLoop, roomId, hostPlayerId } = createTwoPlayerLobbyWithGameLoop();
      gameLoop.startGame(roomId, hostPlayerId);
      const session = getTestSession(gameLoop, roomId)!;
      session.players[0].hand = [];
      session.players[1].hand = [card(Rank.NINE)];
      session.turnIndex = 0;

      expect(gameLoop.playCard(roomId, hostPlayerId).code).toBe("NO_CARDS_LEFT");
    });
  });

  describe("slap", () => {
    it("rejects when game not started", () => {
      const { gameLoop, roomId, hostPlayerId } = createTwoPlayerLobbyWithGameLoop();
      expect(gameLoop.slap(roomId, hostPlayerId).code).toBe("GAME_NOT_STARTED");
    });

    it("rejects unknown player id", () => {
      const { gameLoop, roomId, hostPlayerId } = createTwoPlayerLobbyWithGameLoop();
      gameLoop.startGame(roomId, hostPlayerId);
      const fake = "00000000-0000-0000-0000-000000009999" as PlayerId;
      expect(gameLoop.slap(roomId, fake).code).toBe("PLAYER_NOT_FOUND");
    });

    it("does not treat same rank as good slap (reference equality)", () => {
      const { gameLoop, roomId, hostPlayerId, guestPlayerId } = createTwoPlayerLobbyWithGameLoop();
      gameLoop.startGame(roomId, hostPlayerId);
      const session = getTestSession(gameLoop, roomId)!;
      session.settings.burnCardsOnBadSlap = 0;
      const a = card(Rank.EIGHT, Suit.HEARTS);
      const b = card(Rank.FIVE, Suit.CLUBS);
      const c = card(Rank.EIGHT, Suit.DIAMONDS);
      session.centerPile = [a, b, c];
      const guestHandBefore = session.players[1].hand.length;

      expect(gameLoop.slap(roomId, guestPlayerId).ok).toBe(true);
      expect(session.players[1].hand.length).toBe(guestHandBefore);
      expect(session.centerPile).toHaveLength(3);
    });

    it("returns ok in game even with small pile", () => {
      const { gameLoop, roomId, hostPlayerId } = createTwoPlayerLobbyWithGameLoop();
      gameLoop.startGame(roomId, hostPlayerId);
      expect(gameLoop.slap(roomId, hostPlayerId).ok).toBe(true);
    });

    it("applies slaps in arrival order: first handler wins a good slap, second sees empty pile", () => {
      const { gameLoop, roomId, hostPlayerId, guestPlayerId } = createTwoPlayerLobbyWithGameLoop();
      gameLoop.startGame(roomId, hostPlayerId);
      const session = getTestSession(gameLoop, roomId)!;
      session.settings.burnCardsOnBadSlap = 0;
      const sandwichTop = card(Rank.KING, Suit.HEARTS);
      session.centerPile = [sandwichTop, card(Rank.THREE, Suit.CLUBS), sandwichTop];

      const hostHandBefore = session.players[0].hand.length;
      const guestHandBefore = session.players[1].hand.length;

      // Same order as a single-threaded server processing two "slap" messages that
      // were queued close together: first message runs gameLoop.slap for guest first.
      expect(gameLoop.slap(roomId, guestPlayerId).ok).toBe(true);
      expect(session.players[1].hand.length).toBe(guestHandBefore + 3);
      expect(session.centerPile).toHaveLength(0);

      expect(gameLoop.slap(roomId, hostPlayerId).ok).toBe(true);
      expect(session.players[0].hand.length).toBe(hostHandBefore);
      expect(session.players[1].hand.length).toBe(guestHandBefore + 3);
    });

    it("on a false slap, burns configured cards from slapper to bottom of center pile", () => {
      const { gameLoop, roomId, hostPlayerId, guestPlayerId } = createTwoPlayerLobbyWithGameLoop();
      gameLoop.startGame(roomId, hostPlayerId);
      const session = getTestSession(gameLoop, roomId)!;

      session.settings.burnCardsOnBadSlap = 2;
      const centerBottom = card(Rank.TWO, Suit.HEARTS);
      const centerTop = card(Rank.THREE, Suit.CLUBS);
      session.centerPile = [centerBottom, centerTop];

      const burn1 = card(Rank.ACE, Suit.SPADES);
      const burn2 = card(Rank.KING, Suit.DIAMONDS);
      session.players[1].hand = [card(Rank.SIX), burn2, burn1]; // burn1 is top

      expect(gameLoop.slap(roomId, guestPlayerId).ok).toBe(true);

      expect(session.centerPile).toEqual([burn1, burn2, centerBottom, centerTop]);
      expect(session.burnedCardsOnBadSlapCount).toBe(2);

      const snap = gameLoop.getSnapshotForRoom(roomId, guestPlayerId);
      if (snap?.public.status !== "InGame") throw new Error("expected InGame");
      expect(snap.public.pileCards).toEqual(session.centerPile);
      expect(snap.public.pileBottomCard).toEqual(burn1);
      expect(snap.public.pileTopCard).toEqual(centerTop);
      expect(snap.public.burnedCardsOnBadSlapCount).toBe(2);
      expect(snap.public.lastAction).toMatchObject({
        type: "slap",
        byPlayerId: guestPlayerId,
        wasSuccessful: false,
        burnedCount: 2,
      });
    });

    it("on a false slap, burns only as many cards as the slapper has", () => {
      const { gameLoop, roomId, hostPlayerId, guestPlayerId } = createTwoPlayerLobbyWithGameLoop();
      gameLoop.startGame(roomId, hostPlayerId);
      const session = getTestSession(gameLoop, roomId)!;

      session.settings.burnCardsOnBadSlap = 5;
      const existing = card(Rank.FOUR);
      session.centerPile = [existing];
      const onlyCard = card(Rank.NINE, Suit.HEARTS);
      session.players[1].hand = [onlyCard];

      expect(gameLoop.slap(roomId, guestPlayerId).ok).toBe(true);
      expect(session.centerPile).toEqual([onlyCard, existing]);
      expect(session.burnedCardsOnBadSlapCount).toBe(1);

      const snap = gameLoop.getSnapshotForRoom(roomId, hostPlayerId);
      if (snap?.public.status !== "InGame") throw new Error("expected InGame");
      expect(snap.public.lastAction).toMatchObject({
        type: "slap",
        byPlayerId: guestPlayerId,
        wasSuccessful: false,
        burnedCount: 1,
      });
    });
  });

  describe("game over", () => {
    it("ends game when a player holds all 52 cards", () => {
      const { gameLoop, roomId, hostPlayerId, guestPlayerId } = createTwoPlayerLobbyWithGameLoop();
      gameLoop.startGame(roomId, hostPlayerId);
      const session = getTestSession(gameLoop, roomId)!;
      const winningHand: Card[] = Array.from({ length: 52 }, () => card(Rank.ACE));
      session.players[0].hand = winningHand;
      session.players[1].hand = [];

      expect(gameLoop.slap(roomId, guestPlayerId).ok).toBe(true);

      const over = gameLoop.getSnapshotForRoom(roomId, hostPlayerId);
      expect(over?.public.status).toBe("GameOver");
      if (over?.public.status !== "GameOver") throw new Error("expected GameOver");
      expect(over.public.finalStats.winnerPlayerId).toBe(hostPlayerId);
    });
  });
});
