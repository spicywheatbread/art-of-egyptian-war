import { WebSocketServer, type WebSocket } from "ws";
import { LobbyStore, LobbyStoreError } from "./lobby/store";
import { InvalidGameSettingsError, LastActionEvent} from "./protocol";
import { parseClientMessage, ParseError } from "./lobby/messages";
import { GameLoop } from "./gameLoop";
import {
  AccountServiceError,
  getAccountStats,
  loginAccount,
  recordGameOutcome,
  registerAccount,
} from "./accounts/service";
import type { AccountStats } from "./accounts/types";
import type { RoomId } from "./protocol";

const DEFAULT_PORT = 8080;
export const PROTOCOL_VERSION = 2;

interface AccountHandlers {
  registerAccount(username: string, password: string): Promise<AccountStats>;
  loginAccount(username: string, password: string): Promise<AccountStats>;
  getAccountStats(username: string): Promise<AccountStats>;
  recordGameOutcome(username: string, didWin: boolean): Promise<AccountStats>;
}

interface StartServerOptions {
  port?: number;
  protocolVersion?: number;
  enableDevRecordOutcome?: boolean;
  accounts?: AccountHandlers;
  /** For tests / dependency injection. */
  gameLoop?: GameLoop;
}

export interface RunningServer {
  port: number;
  close: () => Promise<void>;
}

function normalizeUsernameForCompare(username: string): string {
  return username.trim().toLowerCase();
}

function sendError(store: LobbyStore, socket: WebSocket, code: string, message: string): void {
  store.send(socket, { type: "error", code, message });
}

function getAuthenticatedUsername(
  authenticatedBySocket: Map<WebSocket, string>,
  socket: WebSocket,
): string | null {
  return authenticatedBySocket.get(socket) ?? null;
}

export async function startServer(options: StartServerOptions = {}): Promise<RunningServer> {
  const port = options.port ?? Number(process.env.PORT ?? DEFAULT_PORT);
  const protocolVersion = options.protocolVersion ?? PROTOCOL_VERSION;
  const enableDevRecordOutcome =
    options.enableDevRecordOutcome ?? process.env.ENABLE_DEV_RECORD_OUTCOME === "true";
  const accounts: AccountHandlers = options.accounts ?? {
    registerAccount,
    loginAccount,
    getAccountStats,
    recordGameOutcome,
  };
  const wss = new WebSocketServer({ port });
  const store = new LobbyStore();
  const gameLoop = options.gameLoop ?? new GameLoop();
  const authenticatedBySocket = new Map<WebSocket, string>();
  const recordedOutcomesByRoomId = new Set<RoomId>();

  const sendGameSnapshotsForRoom = (roomId: RoomId): void => {
    const snapshots = gameLoop.getSnapshotsForRoom(roomId);
    if (!snapshots) {
      return;
    }

    for (const ws of store.getSocketsInRoom(roomId)) {
      const info = store.getSocketInfo(ws);
      if (!info) {
        continue;
      }
      const snapshot = snapshots.get(info.playerId);
      if (!snapshot) {
        continue;
      }
      store.send(ws, { type: "gameState", room: snapshot});
    }
  };

  const recordOutcomeIfGameOver = async (roomId: RoomId): Promise<void> => {
    if (recordedOutcomesByRoomId.has(roomId)) {
      return;
    }

    const snapshots = gameLoop.getSnapshotsForRoom(roomId);
    if (!snapshots || snapshots.size === 0) {
      return;
    }

    const first = snapshots.values().next().value as { public: { status: string } } | undefined;
    if (!first || first.public.status !== "GameOver") {
      return;
    }

    const winnerPlayerId = (first as unknown as { public: { finalStats: { winnerPlayerId: string | null } } })
      .public.finalStats.winnerPlayerId;
    if (!winnerPlayerId) {
      recordedOutcomesByRoomId.add(roomId);
      return;
    }

    const updates: Array<Promise<unknown>> = [];
    for (const ws of store.getSocketsInRoom(roomId)) {
      const socketInfo = store.getSocketInfo(ws);
      if (!socketInfo) continue;
      const username = authenticatedBySocket.get(ws);
      if (!username) continue;
      const didWin = socketInfo.playerId === winnerPlayerId;
      updates.push(
        accounts.recordGameOutcome(username, didWin).catch((err: unknown) => {
          console.error("Failed to record game outcome", { roomId, username, err });
        }),
      );
    }

    recordedOutcomesByRoomId.add(roomId);
    if (updates.length > 0) {
      await Promise.all(updates);
    }
  };

  wss.on("connection", (socket) => {
    store.send(socket, { type: "welcome", protocol: protocolVersion });

    socket.on("message", async (raw) => {
      let msg;
      try {
        msg = parseClientMessage(raw.toString());
      } catch (err) {
        if (err instanceof ParseError) {
          sendError(store, socket, err.code, err.message);
        }
        return;
      }

      switch (msg.type) {
        case "register": {
          try {
            const account = await accounts.registerAccount(msg.username, msg.password);
            authenticatedBySocket.set(socket, account.username);
            store.send(socket, { type: "authOk", ...account });
          } catch (err) {
            if (err instanceof AccountServiceError) {
              sendError(store, socket, err.code, err.message);
            } else {
              console.error ("reg failed, ", err); 
              sendError(store, socket, "AUTH_FAILED", "Registration failed");
            }
          }
          break;
        }

        case "login": {
          try {
            const account = await accounts.loginAccount(msg.username, msg.password);
            authenticatedBySocket.set(socket, account.username);
            store.send(socket, { type: "authOk", ...account });
          } catch (err) {
            if (err instanceof AccountServiceError) {
              sendError(store, socket, err.code, err.message);
            } else {
              console.error ("login failed, ", err); 
              sendError(store, socket, "AUTH_FAILED", "Login failed");
            }
          }
          break;
        }

        case "getMyStats": {
          const authenticatedUsername = getAuthenticatedUsername(authenticatedBySocket, socket);
          if (!authenticatedUsername) {
            sendError(
              store,
              socket,
              "NOT_AUTHENTICATED",
              "Login or register before viewing stats",
            );
            return;
          }
          try {
            const stats = await accounts.getAccountStats(authenticatedUsername);
            store.send(socket, { type: "myStats", ...stats });
          } catch (err) {
            if (err instanceof AccountServiceError) {
              sendError(store, socket, err.code, err.message);
            } else {
              sendError(store, socket, "STATS_FETCH_FAILED", "Could not load account stats");
            }
          }
          break;
        }

        case "createLobby": {
          const authenticatedUsername = getAuthenticatedUsername(authenticatedBySocket, socket);
          if (!authenticatedUsername) {
            sendError(
              store,
              socket,
              "NOT_AUTHENTICATED",
              "Login or register before lobby actions",
            );
            return;
          }
          if (
            msg.username !== undefined &&
            normalizeUsernameForCompare(msg.username) !==
              normalizeUsernameForCompare(authenticatedUsername)
          ) {
            sendError(
              store,
              socket,
              "AUTH_USERNAME_MISMATCH",
              "username must match the authenticated account",
            );
            return;
          }
          if (store.getSocketInfo(socket)) {
            sendError(
              store,
              socket,
              "ALREADY_IN_ROOM",
              "Leave your current room before creating a new one",
            );
            return;
          }
          try {
            const lobby = store.createRoom(socket, authenticatedUsername, msg.settings);
            gameLoop.createSessionForLobby(lobby);
            store.broadcast(lobby.roomId, { type: "lobbyState", lobby });
          } catch (err) {
            if (err instanceof InvalidGameSettingsError) {
              sendError(store, socket, err.code, err.message);
              return;
            }
            throw err;
          }
          break;
        }

        case "joinLobby": {
          const authenticatedUsername = getAuthenticatedUsername(authenticatedBySocket, socket);
          if (!authenticatedUsername) {
            sendError(
              store,
              socket,
              "NOT_AUTHENTICATED",
              "Login or register before lobby actions",
            );
            return;
          }
          if (
            msg.username !== undefined &&
            normalizeUsernameForCompare(msg.username) !==
              normalizeUsernameForCompare(authenticatedUsername)
          ) {
            sendError(
              store,
              socket,
              "AUTH_USERNAME_MISMATCH",
              "username must match the authenticated account",
            );
            return;
          }
          if (store.getSocketInfo(socket)) {
            sendError(
              store,
              socket,
              "ALREADY_IN_ROOM",
              "Leave your current room before joining another",
            );
            return;
          }
          try {
            const lobby = store.joinRoom(socket, msg.gameCode, authenticatedUsername);
            gameLoop.updateLobbyPlayers(lobby);
            store.broadcast(lobby.roomId, { type: "lobbyState", lobby });
          } catch (err) {
            if (err instanceof LobbyStoreError) {
              sendError(store, socket, err.code, err.message);
              return;
            }
            sendError(store, socket, "ROOM_NOT_FOUND", `No room with code "${msg.gameCode}"`);
          }
          break;
        }

        case "leaveLobby": {
          const socketInfo = store.getSocketInfo(socket);
          const remaining = store.removeSocket(socket);
          if (remaining) {
            gameLoop.updateLobbyPlayers(remaining);
            store.broadcast(remaining.roomId, { type: "lobbyState", lobby: remaining });
          } else if (socketInfo) {
            gameLoop.removeRoom(socketInfo.roomId);
          }
          break;
        }

        case "startGame": {
          const authenticatedUsername = getAuthenticatedUsername(authenticatedBySocket, socket);
          if (!authenticatedUsername) {
            sendError(
              store,
              socket,
              "NOT_AUTHENTICATED",
              "Login or register before lobby actions",
            );
            return;
          }
          if (
            msg.username !== undefined &&
            normalizeUsernameForCompare(msg.username) !==
              normalizeUsernameForCompare(authenticatedUsername)
          ) {
            sendError(
              store,
              socket,
              "AUTH_USERNAME_MISMATCH",
              "username must match the authenticated account",
            );
            return;
          }

          const socketInfo = store.getSocketInfo(socket);
          if (!socketInfo) {
            sendError(store, socket, "NOT_IN_ROOM", "Join a lobby before starting the game");
            return;
          }

          const result = gameLoop.startGame(socketInfo.roomId, socketInfo.playerId);
          if (!result.ok) {
            sendError(store, socket, result.code ?? "GAME_START_FAILED", result.message ?? "");
            return;
          }

          sendGameSnapshotsForRoom(socketInfo.roomId);
          break;
        }

        case "playCard": {
          const authenticatedUsername = getAuthenticatedUsername(authenticatedBySocket, socket);
          if (!authenticatedUsername) {
            sendError(store, socket, "NOT_AUTHENTICATED", "Login or register before playing");
            return;
          }
          if (
            msg.username !== undefined &&
            normalizeUsernameForCompare(msg.username) !==
              normalizeUsernameForCompare(authenticatedUsername)
          ) {
            sendError(
              store,
              socket,
              "AUTH_USERNAME_MISMATCH",
              "username must match the authenticated account",
            );
            return;
          }

          const socketInfo = store.getSocketInfo(socket);
          if (!socketInfo) {
            sendError(store, socket, "NOT_IN_ROOM", "Join a lobby before playing");
            return;
          }

          const result = gameLoop.playCard(socketInfo.roomId, socketInfo.playerId);
          if (!result.ok) {
            sendError(store, socket, result.code ?? "PLAY_FAILED", result.message ?? "");
            return;
          }

          await recordOutcomeIfGameOver(socketInfo.roomId);
          sendGameSnapshotsForRoom(socketInfo.roomId);
          break;
        }

        case "slap": {
          const authenticatedUsername = getAuthenticatedUsername(authenticatedBySocket, socket);
          if (!authenticatedUsername) {
            sendError(store, socket, "NOT_AUTHENTICATED", "Login or register before slapping");
            return;
          }
          if (
            msg.username !== undefined &&
            normalizeUsernameForCompare(msg.username) !==
              normalizeUsernameForCompare(authenticatedUsername)
          ) {
            sendError(
              store,
              socket,
              "AUTH_USERNAME_MISMATCH",
              "username must match the authenticated account",
            );
            return;
          }

          const socketInfo = store.getSocketInfo(socket);
          if (!socketInfo) {
            sendError(store, socket, "NOT_IN_ROOM", "Join a lobby before slapping");
            return;
          }

          const result = gameLoop.slap(socketInfo.roomId, socketInfo.playerId);
          if (!result.ok) {
            sendError(store, socket, result.code ?? "SLAP_FAILED", result.message ?? "");
            return;
          }

          await recordOutcomeIfGameOver(socketInfo.roomId);
          sendGameSnapshotsForRoom(socketInfo.roomId);
          break;
        }

        case "drag": {
          const socketInfo = store.getSocketInfo(socket);
          if (!socketInfo) {
            sendError(store, socket, "NOT_IN_ROOM", "Somehow dragging a card while not in room?");
            return;
          }

          gameLoop.drag(socketInfo.roomId, msg.global_position)

          sendGameSnapshotsForRoom(socketInfo.roomId);
          break;
        }

        case "recordOutcome": {
          if (!enableDevRecordOutcome) {
            sendError(
              store,
              socket,
              "FEATURE_DISABLED",
              "recordOutcome is disabled unless ENABLE_DEV_RECORD_OUTCOME=true",
            );
            return;
          }
          const authenticatedUsername = getAuthenticatedUsername(authenticatedBySocket, socket);
          if (!authenticatedUsername) {
            sendError(
              store,
              socket,
              "NOT_AUTHENTICATED",
              "Login or register before recording stats",
            );
            return;
          }

          try {
            const account = await accounts.recordGameOutcome(authenticatedUsername, msg.didWin);
            store.send(socket, { type: "authOk", ...account });
          } catch (err) {
            if (err instanceof AccountServiceError) {
              sendError(store, socket, err.code, err.message);
            } else {
              sendError(store, socket, "STATS_UPDATE_FAILED", "Could not update account stats");
            }
          }
          break;
        }
      }
    });

    socket.on("close", () => {
      const socketInfo = store.getSocketInfo(socket);
      authenticatedBySocket.delete(socket);
      const remaining = store.removeSocket(socket);
      if (remaining) {
        gameLoop.updateLobbyPlayers(remaining);
        store.broadcast(remaining.roomId, { type: "lobbyState", lobby: remaining });
      } else if (socketInfo) {
        gameLoop.removeRoom(socketInfo.roomId);
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    wss.once("listening", () => resolve());
    wss.once("error", (err) => reject(err));
  });

  const address = wss.address();
  if (!address || typeof address !== "object") {
    throw new Error("Could not determine WebSocket server port");
  }

  return {
    port: address.port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        wss.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      }),
  };
}

if (require.main === module) {
  startServer()
    .then((server) => {
      console.log(`WebSocket server listening on ws://localhost:${server.port}`);
    })
    .catch((err: unknown) => {
      console.error("Failed to start WebSocket server", err);
      process.exit(1);
    });
}
