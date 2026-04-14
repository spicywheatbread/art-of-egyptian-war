# Server tests

Default (fast, no Firebase):

```bash
npm test
```

Runs the **unit** Vitest project only (`--project unit`). From `server/`, you can also use `npx vitest run --project unit`.

All projects (integration tests that need Firestore are skipped unless `RUN_FIRESTORE_INTEGRATION=1`):

```bash
npm run test:all
```

## `lobby.messages.test.ts`

`parseClientMessage`: invalid JSON, unknown `type`, `joinLobby` `gameCode` (four digits), `recordOutcome` `didWin` type. No network.

## `lobby.store.test.ts`

`LobbyStore` capacity and `mergeGameSettings`: `LOBBY_FULL` when at `maxPlayers`, default cap of four then a rejected fifth join, invalid `maxPlayers`.

## `gameLoop.unit.test.ts`

`GameLoop` logic: session lifecycle, `startGame` (dealing for 2–4 players, host-only, player count errors, double start), `playCard` / `slap`, snapshots, game over. Uses in-memory `LobbyStore` via helpers (no WebSocket).

## `websocket.integration.test.ts`

`startServer` with **mocked** accounts: welcome, auth, lobby create/join (including 3- and 4-player flows), `LOBBY_FULL` on a fifth join, `startGame` and `gameState`, `playCard` / `slap` broadcasts, dev `recordOutcome` disabled unless env allows it.

## `firestore-websocket.integration.test.ts` (opt-in)

**Vitest project:** `firestore-integration` (see [`vitest.config.ts`](../vitest.config.ts)).

Real Firestore (emulator or configured project) plus real `registerAccount` / `loginAccount` from [`src/accounts/service.ts`](../src/accounts/service.ts), and `startServer` **without** account mocks. Covers account CRUD-style flows, auth guards on the socket, two-player lobby, leaving so the room disappears (`ROOM_NOT_FOUND` on stale code), and `startGame` with two players.

- Set `RUN_FIRESTORE_INTEGRATION=1` or the suite is skipped.
- Env for the Admin SDK is applied in [`tests/setup/firestore-integration-env.ts`](setup/firestore-integration-env.ts) before Firebase loads.
- Teardown uses `deleteAccountForTesting` from the accounts service (test-only helper).

**One-shot (starts the Firestore emulator, then runs the project):**

```bash
npm run test:firestore-integration
```

Requires network on first run (`npx firebase-tools`). If the emulator is already running, you can run:

```bash
RUN_FIRESTORE_INTEGRATION=1 npx vitest run --project firestore-integration
```

## Helpers

- `helpers/twoPlayerLobby.ts` — `createTwoPlayerLobbyWithGameLoop`
- `helpers/multiPlayerLobby.ts` — `createMultiPlayerLobbyWithGameLoop` (3 or 4 players)
- `helpers/wsClient.ts` — `openClient`, `closeClient`, `TestClient` for WebSocket integration tests
