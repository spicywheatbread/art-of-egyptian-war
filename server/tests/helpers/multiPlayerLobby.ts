import { GameLoop } from "../../src/gameLoop";
import { LobbyStore } from "../../src/lobby/store";
import type { LobbyRoomState, PlayerId, RoomId } from "../../src/protocol";
import { mockSocket } from "./twoPlayerLobby";

export interface MultiPlayerSetup {
  gameLoop: GameLoop;
  store: LobbyStore;
  lobby: LobbyRoomState;
  roomId: RoomId;
  hostPlayerId: PlayerId;
  /** Host first, then guests in join order. */
  playerIds: PlayerId[];
}

type ThreeOrFour = readonly [string, string, string] | readonly [string, string, string, string];

export function createMultiPlayerLobbyWithGameLoop(usernames: ThreeOrFour): MultiPlayerSetup {
  const gameLoop = new GameLoop();
  const store = new LobbyStore();
  const [hostName, ...guestNames] = usernames;

  const hostSocket = mockSocket();
  let lobby = store.createRoom(hostSocket, hostName);

  for (const name of guestNames) {
    lobby = store.joinRoom(mockSocket(), lobby.gameCode, name);
  }

  gameLoop.createSessionForLobby(lobby);

  return {
    gameLoop,
    store,
    lobby,
    roomId: lobby.roomId,
    hostPlayerId: lobby.hostPlayerId,
    playerIds: lobby.players.map((p) => p.playerId),
  };
}
