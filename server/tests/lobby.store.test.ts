import type WebSocket from "ws";
import { describe, expect, it } from "vitest";
import { LobbyStore } from "../src/lobby/store";

function mockSocket(): WebSocket {
  return {} as WebSocket;
}

describe("LobbyStore", () => {
  it("creates a room and lets another player join by game code", () => {
    const store = new LobbyStore();
    const hostSocket = mockSocket();
    const guestSocket = mockSocket();

    const lobby = store.createRoom(hostSocket, "Alice");
    const updated = store.joinRoom(guestSocket, lobby.gameCode, "Bob");

    expect(updated.players).toHaveLength(2);
    expect(updated.players.map((p) => p.username)).toEqual(["Alice", "Bob"]);
    expect(store.getSocketInfo(hostSocket)).toBeDefined();
    expect(store.getSocketInfo(guestSocket)).toBeDefined();
  });

  it("promotes the next player when host leaves", () => {
    const store = new LobbyStore();
    const hostSocket = mockSocket();
    const guestSocket = mockSocket();

    const lobby = store.createRoom(hostSocket, "Alice");
    const joined = store.joinRoom(guestSocket, lobby.gameCode, "Bob");
    const guestPlayerId = joined.players.find((p) => p.username === "Bob")?.playerId;

    const remaining = store.removeSocket(hostSocket);

    expect(remaining).not.toBeNull();
    expect(remaining?.players).toHaveLength(1);
    expect(remaining?.players[0]?.username).toBe("Bob");
    expect(remaining?.hostPlayerId).toBe(guestPlayerId);
  });

  it("cleans up room when last player disconnects", () => {
    const store = new LobbyStore();
    const hostSocket = mockSocket();

    const lobby = store.createRoom(hostSocket, "Alice");
    const remaining = store.removeSocket(hostSocket);

    expect(remaining).toBeNull();
    expect(store.getRoom(lobby.roomId)).toBeUndefined();
    expect(() => store.joinRoom(mockSocket(), lobby.gameCode, "Bob")).toThrowError();
  });
});
