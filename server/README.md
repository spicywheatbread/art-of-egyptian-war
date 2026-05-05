# Server

WebSocket game server for Art of Egyptian War. Manages lobby rooms where players connect, create or join games, and eventually play through a real-time card game session.

## Structure

```
src/
  index.ts              – Entry point; WebSocket server, message routing, disconnect handling
  gameLoop.ts           – Game state machine and core gameplay mechanics (dealing, turns, slaps, win conditions)
  accounts/service.ts   – Firestore-backed register/login and persistent stats updates
  db/firestore.ts       – Firebase Admin SDK initialization (service account or ADC)
  protocol/
    index.ts            – Protocol version constant
    card.ts             – Card types (rank, suit enums)
    ids.ts              – Type aliases (PlayerId, RoomId, GameSessionId)
    user.ts             – Player and account statistics structures
    gameSettings.ts     – Configurable game rules
    gameState.ts        – Game room state structures (Lobby, InGame, GameOver phases)
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
| `startGame`     | _(none)_                           | host only; deals cards and transitions to InGame |
| `playCard`      | `cardIndex`                        | player plays a card on their turn |
| `slap`          | _(none)_                           | player attempts to slap the center pile |
| `drag`          | `x`, `y`                           | sends card drag position for UI synchronization |
| `getMyStats`    | _(none)_                           | retrieves account statistics |
| `recordOutcome` | `didWin`                           | dev-only stats update; requires `ENABLE_DEV_RECORD_OUTCOME=true` |

**Server → Client**

| `type`       | Fields                                   | Notes |
|--------------|------------------------------------------|-------|
| `welcome`    | `protocol` (version number)              | sent immediately on connection |
| `authOk`     | `username`, `wins`, `gamesPlayed`        | sent after successful register/login |
| `lobbyState` | `lobby` (full `LobbyRoomState` snapshot) | sent when room state changes or after join |
| `gameState`  | `game` (full `GameRoomState` snapshot)   | sent periodically during active game; includes turn info, center pile, hand counts |
| `myStats`    | `stats` (account statistics)             | response to `getMyStats` request |
| `error`      | `code`, `message`                        | sent on any error condition |

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

## Game Flow & Mechanics

### Room Lifecycle
1. **Lobby Phase**: Players join and wait for host to start
2. **InGame Phase**: Cards are dealt; players take turns playing cards, attempting slaps
3. **GameOver Phase**: Winner determined; statistics recorded to Firestore

### Card Dealing
Full 52-card deck distributed round-robin to all players at game start.

### Royal Cards
When a player plays **Jack** (1 chance), **Queen** (2 chances), **King** (3 chances), or **Ace** (4 chances), the next player gets that many opportunities to flip a card from the draw pile:
- If they flip a non-royal card, they collect the center pile
- If they flip another royal card, the turns pass to the next player
- If they run out of chances, they collect the center pile

### Slap Rules
Players can slap the center pile when:
- **Pair**: Two consecutive cards of the same rank
- **Sandwich**: Same rank with exactly one card between them

Successful slap wins the center pile. **Bad slap** (invalid slap) results in a configurable penalty (1–52 cards burned or entire hand).

### Turn Management
- Players take turns in circular order
- Players with no cards are skipped
- Turn passes after playing a card (unless it's a royal card)

### Win Condition
First player to collect all 52 cards or last player remaining with cards.

### Configurable Game Settings
To be implemented
- `includeJokers` – Include 2 jokers in deck
- `enableTopSlaps`, `enableBottomSlaps` – Allow slaps (independent toggle)
- `burnCardsOnBadSlap` – Cards lost for bad slap (1–52 or "ENTIRE_HAND")
- `turnTimeLimitMs` – Optional turn timeout (null = no limit)
- `maxPlayers` – 2–4 players
- `enableSlapOnRankMatch`, `enableSlapOnSuitMatch` – Additional slap rules (experimental)

### Statistics & Persistence
After each game, player stats are recorded to Firestore (`accounts` collection):
- `wins` – Total games won
- `gamesPlayed` – Total games played
- Per-game metrics: successful slaps, unsuccessful slaps, longest game duration
