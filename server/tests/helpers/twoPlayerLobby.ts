import type WebSocket from "ws";
import { GameLoop } from "../../src/gameLoop";
import { LobbyStore } from "../../src/lobby/store";
import type { LobbyRoomState, PlayerId, RoomId } from "../../src/protocol";

export function mockSocket(): WebSocket {
  return {} as WebSocket;
}

export interface TwoPlayerSetup {
  gameLoop: GameLoop;
  store: LobbyStore;
  lobby: LobbyRoomState;
  roomId: RoomId;
  hostPlayerId: PlayerId;
  guestPlayerId: PlayerId;
}

/**
 * Creates a lobby with Alice (host) and Bob (guest) and registers a matching GameLoop session.
 */
export function createTwoPlayerLobbyWithGameLoop(): TwoPlayerSetup {
  const gameLoop = new GameLoop();
  const store = new LobbyStore();
  const hostSocket = mockSocket();
  const guestSocket = mockSocket();

  const created = store.createRoom(hostSocket, "Alice");
  const lobby = store.joinRoom(guestSocket, created.gameCode, "Bob");
  gameLoop.createSessionForLobby(lobby);

  const guestPlayerId = lobby.players.find((p) => p.username === "Bob")!.playerId;

  return {
    gameLoop,
    store,
    lobby,
    roomId: lobby.roomId,
    hostPlayerId: lobby.hostPlayerId,
    guestPlayerId,
  };
}
