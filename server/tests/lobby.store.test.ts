import { describe, expect, it } from "vitest";
import { LobbyStore, LobbyStoreError } from "../src/lobby/store";
import { InvalidGameSettingsError, MAX_PLAYERS_PER_GAME, mergeGameSettings } from "../src/protocol";
import { mockSocket } from "./helpers/twoPlayerLobby";

describe("LobbyStore", () => {
  it("rejects join when lobby is at maxPlayers", () => {
    const store = new LobbyStore();
    const host = mockSocket();
    const lobby = store.createRoom(host, "Host", { maxPlayers: 2 });
    store.joinRoom(mockSocket(), lobby.gameCode, "Guest");
    expect(() => store.joinRoom(mockSocket(), lobby.gameCode, "Third")).toThrowError(
      expect.objectContaining({ code: "LOBBY_FULL" }),
    );
  });

  it("allows four players with default maxPlayers then rejects a fifth join", () => {
    const store = new LobbyStore();
    const lobby = store.createRoom(mockSocket(), "P0");
    expect(lobby.settings.maxPlayers).toBe(MAX_PLAYERS_PER_GAME);
    for (let i = 1; i < 4; i++) {
      store.joinRoom(mockSocket(), lobby.gameCode, `P${i}`);
    }
    expect(store.getRoom(lobby.roomId)!.players).toHaveLength(4);
    expect(() => store.joinRoom(mockSocket(), lobby.gameCode, "P4")).toThrow(LobbyStoreError);
  });

  it("mergeGameSettings rejects out-of-range maxPlayers", () => {
    expect(() => mergeGameSettings({ maxPlayers: 1 })).toThrow(InvalidGameSettingsError);
    expect(() => mergeGameSettings({ maxPlayers: 5 })).toThrow(InvalidGameSettingsError);
  });
});
