# WebSocket Protocol

Transport and framing contract for Godot clients:

- Connect with `ws://host:port` (or `wss://` behind TLS).
- Send one JSON object per text frame.
- Every payload has a string `type` discriminator.
- Current protocol version is `2` (sent by `welcome`).

## Client -> Server

### register

```json
{ "type": "register", "username": "Alice", "password": "secret123" }
```

### login

```json
{ "type": "login", "username": "Alice", "password": "secret123" }
```

### createLobby

```json
{ "type": "createLobby" }
```

Optional compatibility form (server validates match against authenticated account):

```json
{ "type": "createLobby", "username": "Alice" }
```

### joinLobby

```json
{ "type": "joinLobby", "gameCode": "1234" }
```

Optional compatibility form:

```json
{ "type": "joinLobby", "gameCode": "1234", "username": "Alice" }
```

### leaveLobby

```json
{ "type": "leaveLobby" }
```

### recordOutcome (dev-only)

Enabled only when `ENABLE_DEV_RECORD_OUTCOME=true`.

```json
{ "type": "recordOutcome", "didWin": true }
```

## Server -> Client

### welcome

```json
{ "type": "welcome", "protocol": 2 }
```

### authOk

```json
{ "type": "authOk", "username": "Alice", "wins": 1, "gamesPlayed": 3 }
```

### lobbyState

```json
{
  "type": "lobbyState",
  "lobby": {
    "status": "Lobby",
    "roomId": "uuid",
    "gameCode": "1234",
    "hostPlayerId": "uuid",
    "players": [{ "playerId": "uuid", "username": "Alice" }],
    "settings": { "maxPlayers": 4, "turnTimeMs": 30000 },
    "createdAtMs": 1712500000000
  }
}
```

### error

```json
{ "type": "error", "code": "NOT_AUTHENTICATED", "message": "Login or register before lobby actions" }
```

Typical `code` values: `INVALID_JSON`, `UNKNOWN_TYPE`, `INVALID_USERNAME`, `INVALID_CREDENTIALS`, `USERNAME_TAKEN`, `NOT_AUTHENTICATED`, `ROOM_NOT_FOUND`.
