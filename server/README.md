# Server

WebSocket game server for Art of Egyptian War. Manages lobby rooms where players connect, create or join games, and eventually play through a real-time card game session.

## Structure

```
src/
  index.ts              – Entry point; WebSocket server, message routing, disconnect handling
  accounts/service.ts   – Firestore-backed register/login and persistent stats updates
  db/firestore.ts       – Firebase Admin SDK initialization (service account or ADC)
  protocol/             – Shared types (game state, cards, IDs, settings)
  lobby/
    store.ts            – In-memory lobby state (rooms, sockets, create/join/leave, broadcast)
    messages.ts         – Client/server message types and JSON validation
```

## Wire Protocol

All messages are one UTF-8 JSON object per WebSocket text frame and include a `type` field.

**Client → Server**

| `type`          | Required fields                    | Notes |
|-----------------|------------------------------------|-------|
| `register`      | `username`, `password`             | creates Firestore account and logs in |
| `login`         | `username`, `password`             | validates credentials and logs in |
| `createLobby`   | _(none)_                           | optional `username` must match authenticated user |
| `joinLobby`     | `gameCode`                         | optional `username` must match authenticated user |
| `leaveLobby`    | _(none)_                           | leaves current room |
| `recordOutcome` | `didWin`                           | dev-only stats update; requires `ENABLE_DEV_RECORD_OUTCOME=true` |

**Server → Client**

| `type`       | Fields                                   |
|--------------|------------------------------------------|
| `welcome`    | `protocol` (version number)              |
| `authOk`     | `username`, `wins`, `gamesPlayed`        |
| `lobbyState` | `lobby` (full `LobbyRoomState` snapshot) |
| `error`      | `code`, `message`                        |

Recommended client flow (Godot): connect → read `welcome` → `register`/`login` → lobby messages.

Full message shapes and examples are in `PROTOCOL.md`.

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

## Firebase Setup

This server uses Firebase Admin SDK + Firestore (`accounts` collection) from Node only.

1. Authenticate and verify project:
   - `npx -y firebase-tools@latest login`
   - `npx -y firebase-tools@latest use`
2. Keep deny-all client rules:
   - `firestore.rules` is already `allow read, write: if false;`
   - deploy with `npx -y firebase-tools@latest deploy --only firestore:rules`
3. Create a service account key in Google Cloud Console and save outside git (for example `server/.secrets/serviceAccounts.json`).
4. Configure credentials before starting server:
   - `export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/serviceAccount.json`
   - optional: `export FIREBASE_PROJECT_ID=your-project-id`
   - optional alternative: `export FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'`

## Teammate Firebase Account Onboarding

Use this to set up your Firebase access on your own machine.

1. Install deps and Firebase CLI access:
   - `cd server && npm install`
   - `npx -y firebase-tools@latest --version`
2. Sign in with your own Google account:
   - `npx -y firebase-tools@latest login`
3. Connect to the correct Firebase project:
   - `npx -y firebase-tools@latest use`
   - if project is not selected: `npx -y firebase-tools@latest use --add <PROJECT_ID>`
4. Get Firestore permissions:
   - ask a project admin to add you in Firebase Console with Firestore access
5. Create your own service account key JSON (or receive an approved key file), then store it outside git:
   - recommended local path: `server/.secrets/serviceAccounts.json`
   - never commit this file
6. Export credentials in your shell before running the server:
   - `export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/serviceAccounts.json`
   - optional: `export FIREBASE_PROJECT_ID=<PROJECT_ID>`
7. Verify connection:
   - `npx -y firebase-tools@latest use` should print the expected project
   - `npm run dev` should start without Firebase credential errors
   - a `register` message should return `authOk` and create a doc in `accounts`

## Testing

Run all test suites:

```bash
npm test
```

Watch mode while developing:

```bash
npm run test:watch
```

Current coverage includes:

- websocket integration flow (`welcome`, auth guard, register, create/join lobby broadcast)
- message parsing and validation (`parseClientMessage`)
- lobby state management (`LobbyStore` create/join/leave and host promotion)

## Quick Test

Connect two WebSocket clients (e.g. using `websocat`, Postman, or a script):

```
# Terminal 1 – register and create a lobby
wscat -c ws://localhost:8080
< {"type":"welcome","protocol":2}
> {"type":"register","username":"Alice","password":"secret123"}
< {"type":"authOk","username":"Alice","wins":0,"gamesPlayed":0}
> {"type":"createLobby"}
< {"type":"lobbyState","lobby":{"roomId":"...","players":[...],...}}

# Terminal 2 – join with the gameCode from above
wscat -c ws://localhost:8080
< {"type":"welcome","protocol":2}
> {"type":"register","username":"Bob","password":"secret123"}
< {"type":"authOk","username":"Bob","wins":0,"gamesPlayed":0}
> {"type":"joinLobby","gameCode":"<gameCode>"}
< {"type":"lobbyState","lobby":{"players":[Alice, Bob],...}}
```

Both clients receive the updated `lobbyState` whenever someone joins, leaves, or disconnects.
