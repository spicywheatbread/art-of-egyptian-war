import { WebSocketServer, type WebSocket } from "ws";
import { LobbyStore } from "./lobby/store";
import { parseClientMessage, ParseError } from "./lobby/messages";
import {
  AccountServiceError,
  loginAccount,
  recordGameOutcome,
  registerAccount,
} from "./accounts/service";
import type { AccountStats } from "./accounts/types";

const DEFAULT_PORT = 8080;
export const PROTOCOL_VERSION = 2;

interface AccountHandlers {
  registerAccount(username: string, password: string): Promise<AccountStats>;
  loginAccount(username: string, password: string): Promise<AccountStats>;
  recordGameOutcome(username: string, didWin: boolean): Promise<AccountStats>;
}

interface StartServerOptions {
  port?: number;
  protocolVersion?: number;
  enableDevRecordOutcome?: boolean;
  accounts?: AccountHandlers;
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
    recordGameOutcome,
  };
  const wss = new WebSocketServer({ port });
  const store = new LobbyStore();
  const authenticatedBySocket = new Map<WebSocket, string>();

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
              sendError(store, socket, "AUTH_FAILED", "Login failed");
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
          const lobby = store.createRoom(socket, authenticatedUsername, msg.settings);
          store.broadcast(lobby.roomId, { type: "lobbyState", lobby });
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
            store.broadcast(lobby.roomId, { type: "lobbyState", lobby });
          } catch {
            sendError(store, socket, "ROOM_NOT_FOUND", `No room with code "${msg.gameCode}"`);
          }
          break;
        }

        case "leaveLobby": {
          const remaining = store.removeSocket(socket);
          if (remaining) {
            store.broadcast(remaining.roomId, { type: "lobbyState", lobby: remaining });
          }
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
      authenticatedBySocket.delete(socket);
      const remaining = store.removeSocket(socket);
      if (remaining) {
        store.broadcast(remaining.roomId, { type: "lobbyState", lobby: remaining });
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
