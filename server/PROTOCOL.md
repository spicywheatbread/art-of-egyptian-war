# WebSocket Protocol

Transport and framing contract for Godot clients:

- Connect with `ws://host:port` (or `wss://` behind TLS).
- Send one JSON object per text frame.
- Every payload has a string `type` discriminator.
- Current protocol version is `2` (sent by `welcome`).

## Player limits

Lobbies and games support 2–4 players (Egyptian War). The server enforces this as follows:

- `settings.maxPlayers` (integer, default 4) caps how many accounts can be in a lobby. Allowed range when creating a lobby is 2–4 inclusive.
- `joinLobby` fails with `LOBBY_FULL` when the room already has `maxPlayers` members.
- `startGame` requires at least 2 players and no more than `maxPlayers` (and never more than 4). Otherwise the server returns `NOT_ENOUGH_PLAYERS` or `TOO_MANY_PLAYERS`.

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

Optional fields:

- `username`: must match the authenticated account if present (compatibility with older clients).
- `settings`: partial `GameSettings` (see below). Omitted fields use server defaults. Invalid `maxPlayers` (not an integer from 2 to 4) yields `INVALID_GAME_SETTINGS`.

Example with a 2-player cap:

```json
{
  "type": "createLobby",
  "settings": { "maxPlayers": 2 }
}
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

### startGame

Host-only; sender must be in the lobby and authenticated. Optional `username` (when present) must match the authenticated account.

```json
{ "type": "startGame" }
```

### playCard

Optional `username` (when present) must match the authenticated account.

```json
{ "type": "playCard" }
```

### slap

Optional `username` (when present) must match the authenticated account.

```json
{ "type": "slap" }
```

### recordOutcome (dev-only)

Enabled only when `ENABLE_DEV_RECORD_OUTCOME=true`.

```json
{ "type": "recordOutcome", "didWin": true }
```

## GameSettings (in `lobby.settings`)

Fields the server uses today (others may be added):

| Field | Type | Notes |
|-------|------|--------|
| `includeJokers` | boolean | |
| `enableTopSlaps` | boolean | |
| `enableBottomSlaps` | boolean | |
| `burnCardsOnBadSlap` | number | |
| `turnTimeLimitMs` | number \| null | |
| `maxPlayers` | number | 2–4, default 4 |

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
    "settings": {
      "includeJokers": false,
      "enableTopSlaps": true,
      "enableBottomSlaps": false,
      "burnCardsOnBadSlap": 2,
      "turnTimeLimitMs": null,
      "maxPlayers": 4
    },
    "createdAtMs": 1712500000000
  }
}
```

### gameState

Per-player snapshot after the game starts or when state changes (e.g. after `playCard` / `slap`). Shape matches `RoomSnapshotForPlayer` in the server types.

### error

```json
{ "type": "error", "code": "NOT_AUTHENTICATED", "message": "Login or register before lobby actions" }
```

### Error `code` values

**Parse / message shape** (before handler runs): `INVALID_JSON`, `INVALID_PAYLOAD`, `UNKNOWN_TYPE`, `INVALID_USERNAME`, `INVALID_PASSWORD`, `INVALID_GAME_CODE`, `INVALID_DID_WIN`, …

**Auth / accounts**: `INVALID_CREDENTIALS`, `USERNAME_TAKEN`, `NOT_AUTHENTICATED`, `AUTH_USERNAME_MISMATCH`, `AUTH_FAILED`

**Lobby**: `ALREADY_IN_ROOM`, `INVALID_GAME_SETTINGS`, `ROOM_NOT_FOUND`, `LOBBY_FULL`, `NOT_IN_ROOM`

**Starting / playing**: `HOST_ONLY`, `NOT_ENOUGH_PLAYERS`, `TOO_MANY_PLAYERS`, `GAME_ALREADY_STARTED`, `GAME_START_FAILED`, `GAME_NOT_STARTED`, `NOT_YOUR_TURN`, `NO_CARDS_LEFT`, `PLAYER_NOT_FOUND`, `PLAY_FAILED`, `SLAP_FAILED`

**Dev**: `FEATURE_DISABLED`, `STATS_UPDATE_FAILED` (and account-related codes from `recordOutcome`)

Handlers may forward additional **`GameLoop`** codes (e.g. `ROOM_NOT_FOUND`) via the same `error` message.
