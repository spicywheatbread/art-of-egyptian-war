import { WebSocketServer } from "ws";
import { LobbyStore } from "./lobby/store";
import { parseClientMessage, ParseError } from "./lobby/messages";

const PORT = Number(process.env.PORT ?? 8080);
const PROTOCOL_VERSION = 1;

const wss = new WebSocketServer({ port: PORT });
const store = new LobbyStore();

wss.on("connection", (socket) => {
  store.send(socket, { type: "welcome", protocol: PROTOCOL_VERSION });

  socket.on("message", (raw) => {
    let msg;
    try {
      msg = parseClientMessage(raw.toString());
    } catch (err) {
      if (err instanceof ParseError) {
        store.send(socket, { type: "error", code: err.code, message: err.message });
      }
      return;
    }

    switch (msg.type) {
      case "createLobby": {
        if (store.getSocketInfo(socket)) {
          store.send(socket, {
            type: "error",
            code: "ALREADY_IN_ROOM",
            message: "Leave your current room before creating a new one",
          });
          return;
        }
        const lobby = store.createRoom(socket, msg.username, msg.settings);
        store.broadcast(lobby.roomId, { type: "lobbyState", lobby });
        break;
      }

      case "joinLobby": {
        if (store.getSocketInfo(socket)) {
          store.send(socket, {
            type: "error",
            code: "ALREADY_IN_ROOM",
            message: "Leave your current room before joining another",
          });
          return;
        }
        try {
          const lobby = store.joinRoom(socket, msg.gameCode, msg.username);
          store.broadcast(lobby.roomId, { type: "lobbyState", lobby });
        } catch {
          store.send(socket, {
            type: "error",
            code: "ROOM_NOT_FOUND",
            message: `No room with code "${msg.gameCode}"`,
          });
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
    }
  });

  socket.on("close", () => {
    const remaining = store.removeSocket(socket);
    if (remaining) {
      store.broadcast(remaining.roomId, { type: "lobbyState", lobby: remaining });
    }
  });
});

console.log(`WebSocket server listening on ws://localhost:${PORT}`);
