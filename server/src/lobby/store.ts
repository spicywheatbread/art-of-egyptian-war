import { randomUUID } from "crypto";
import type WebSocket from "ws";
import type {
  PlayerId,
  RoomId,
  LobbyRoomState,
  GameSettings,
} from "../protocol";
import { defaultGameSettings } from "../protocol";
import type { ServerMessage } from "./messages";

interface SocketInfo {
  playerId: PlayerId;
  roomId: RoomId;
}

export class LobbyStore {
  private rooms = new Map<RoomId, LobbyRoomState>();
  private roomSockets = new Map<RoomId, Set<WebSocket>>();
  private socketInfo = new Map<WebSocket, SocketInfo>();
  private codeToRoomId = new Map<string, RoomId>();

  private generateGameCode(): string {
    for (let attempts = 0; attempts < 100; attempts++) {
      const code = String(Math.floor(1000 + Math.random() * 9000));
      if (!this.codeToRoomId.has(code)) return code;
    }
    throw new Error("Unable to generate unique game code");
  }

  createRoom(
    socket: WebSocket,
    username: string,
    settingsOverrides?: Partial<GameSettings>,
  ): LobbyRoomState {
    const roomId = randomUUID() as RoomId;
    const playerId = randomUUID() as PlayerId;
    const gameCode = this.generateGameCode();
    const settings: GameSettings = { ...defaultGameSettings(), ...settingsOverrides };

    const lobby: LobbyRoomState = {
      status: "Lobby",
      roomId,
      gameCode,
      hostPlayerId: playerId,
      players: [{ playerId, username }],
      settings,
      createdAtMs: Date.now(),
    };

    this.rooms.set(roomId, lobby);
    this.codeToRoomId.set(gameCode, roomId);
    this.roomSockets.set(roomId, new Set([socket]));
    this.socketInfo.set(socket, { playerId, roomId });

    return lobby;
  }

  joinRoom(
    socket: WebSocket,
    gameCode: string,
    username: string,
  ): LobbyRoomState {
    const roomId = this.codeToRoomId.get(gameCode);
    if (!roomId) {
      throw new Error("Room not found");
    }
    const lobby = this.rooms.get(roomId);
    if (!lobby) {
      throw new Error("Room not found");
    }

    const playerId = randomUUID() as PlayerId;
    lobby.players.push({ playerId, username });

    this.roomSockets.get(roomId)!.add(socket);
    this.socketInfo.set(socket, { playerId, roomId });

    return lobby;
  }

  removeSocket(socket: WebSocket): LobbyRoomState | null {
    const info = this.socketInfo.get(socket);
    if (!info) return null;

    this.socketInfo.delete(socket);
    const { roomId, playerId } = info;

    const sockets = this.roomSockets.get(roomId);
    sockets?.delete(socket);

    const lobby = this.rooms.get(roomId);
    if (!lobby) return null;

    lobby.players = lobby.players.filter((p) => p.playerId !== playerId);

    if (lobby.players.length === 0) {
      this.rooms.delete(roomId);
      this.roomSockets.delete(roomId);
      this.codeToRoomId.delete(lobby.gameCode);
      return null;
    }

    // Promote next player if host left
    if (lobby.hostPlayerId === playerId) {
      lobby.hostPlayerId = lobby.players[0].playerId;
    }

    return lobby;
  }

  getRoom(roomId: RoomId): LobbyRoomState | undefined {
    return this.rooms.get(roomId);
  }

  getSocketInfo(socket: WebSocket): SocketInfo | undefined {
    return this.socketInfo.get(socket);
  }

  broadcast(roomId: RoomId, message: ServerMessage): void {
    const sockets = this.roomSockets.get(roomId);
    if (!sockets) return;
    const payload = JSON.stringify(message);
    for (const ws of sockets) {
      if (ws.readyState === ws.OPEN) {
        ws.send(payload);
      }
    }
  }

  send(socket: WebSocket, message: ServerMessage): void {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }
}
