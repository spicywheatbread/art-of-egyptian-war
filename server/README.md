# Server

WebSocket game server for Art of Egyptian War. Manages lobby rooms where players connect, create or join games, and eventually play through a real-time card game session.

## Structure

```
src/
  index.ts              – Entry point; WebSocket server, message routing, disconnect handling
  protocol/             – Shared types (game state, cards, IDs, settings)
  lobby/
    store.ts            – In-memory lobby state (rooms, sockets, create/join/leave, broadcast)
    messages.ts         – Client/server message types and JSON validation
```

## Message Protocol

All messages are JSON with a `type` discriminator.

**Client → Server**

| `type`        | Fields                                   |
|---------------|------------------------------------------|
| `createLobby` | `username`, optional `settings`          |
| `joinLobby`   | `roomId`, `username`                     |
| `leaveLobby`  | _(none)_                                 |

**Server → Client**

| `type`        | Fields                                   |
|---------------|------------------------------------------|
| `welcome`     | `protocol` (version number)              |
| `lobbyState`  | `lobby` (full `LobbyRoomState` snapshot) |
| `error`       | `code`, `message`                        |

## Getting Started

```bash
npm install
npm run dev       # starts on ws://localhost:8080 with hot reload
```

To build and run without hot reload:

```bash
npm run build
npm start
```

Override the port with `PORT=3000 npm run dev`.

## Quick Test

Connect two WebSocket clients (e.g. using `websocat`, Postman, or a script):

```
# Terminal 1 – create a lobby
wscat -c ws://localhost:8080
> {"type":"createLobby","username":"Alice"}
< {"type":"lobbyState","lobby":{"roomId":"...","players":[...],...}}

# Terminal 2 – join with the roomId from above
wscat -c ws://localhost:8080
> {"type":"joinLobby","roomId":"<roomId>","username":"Bob"}
< {"type":"lobbyState","lobby":{"players":[Alice, Bob],...}}
```

Both clients receive the updated `lobbyState` whenever someone joins, leaves, or disconnects.
