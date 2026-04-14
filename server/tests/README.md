# Server tests

Run with `npx vitest run` from `server/`.

## `lobby.messages.test.ts`

`parseClientMessage`: invalid JSON, unknown `type`, `joinLobby` `gameCode` (four digits), `recordOutcome` `didWin` type. No network.

## `lobby.store.test.ts`

`LobbyStore` capacity and `mergeGameSettings`: `LOBBY_FULL` when at `maxPlayers`, default cap of four then a rejected fifth join, invalid `maxPlayers`.

## `gameLoop.unit.test.ts`

`GameLoop` logic: session lifecycle, `startGame` (dealing for 2–4 players, host-only, player count errors, double start), `playCard` / `slap`, snapshots, game over. Uses in-memory `LobbyStore` via helpers (no WebSocket).

## `websocket.integration.test.ts`

`startServer` with mocked accounts: welcome, auth, lobby create/join (including 3- and 4-player flows), `LOBBY_FULL` on a fifth join, `startGame` and `gameState`, `playCard` / `slap` broadcasts, dev `recordOutcome` disabled unless env allows it.

## Helpers

- `helpers/twoPlayerLobby.ts` — `createTwoPlayerLobbyWithGameLoop`
- `helpers/multiPlayerLobby.ts` — `createMultiPlayerLobbyWithGameLoop` (3 or 4 players)
