import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteAccountForTesting, loginAccount, registerAccount } from "../src/accounts/service";
import { PROTOCOL_VERSION, type RunningServer, startServer } from "../src/index";
import { closeClient, type TestClient, openClient } from "./helpers/wsClient";

const PASSWORD = "pass12345";
const shouldRun = process.env.RUN_FIRESTORE_INTEGRATION === "1";

/** Must match `USERNAME_PATTERN` in accounts/service: 3–20 chars, [a-zA-Z0-9_]. */
function uniqueUsername(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "u";
  for (let i = 0; i < 10; i++) {
    s += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return s;
}

describe.skipIf(!shouldRun)("Account service (Firestore)", () => {
  const accountsToDelete: string[] = [];

  afterEach(async () => {
    await Promise.all(
      accountsToDelete.splice(0).map((u) => deleteAccountForTesting(u).catch(() => {})),
    );
  });

  it("registers and logs in with the same stats", async () => {
    const username = uniqueUsername();
    accountsToDelete.push(username);

    const created = await registerAccount(username, PASSWORD);
    expect(created).toEqual({ username, wins: 0, gamesPlayed: 0 });

    const session = await loginAccount(username, PASSWORD);
    expect(session).toEqual(created);
  });

  it("rejects login with wrong password", async () => {
    const username = uniqueUsername();
    accountsToDelete.push(username);
    await registerAccount(username, PASSWORD);

    await expect(loginAccount(username, "wrongpass")).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
  });

  it("rejects duplicate registration", async () => {
    const username = uniqueUsername();
    accountsToDelete.push(username);
    await registerAccount(username, PASSWORD);

    await expect(registerAccount(username, PASSWORD)).rejects.toMatchObject({
      code: "USERNAME_TAKEN",
    });
  });
});

describe.skipIf(!shouldRun)("WebSocket with real accounts", () => {
  let server: RunningServer;
  const clients: TestClient[] = [];
  const accountsToDelete: string[] = [];

  beforeEach(async () => {
    server = await startServer({ port: 0, enableDevRecordOutcome: false });
  });

  afterEach(async () => {
    await Promise.all(clients.map((c) => closeClient(c.ws)));
    clients.length = 0;
    await server.close();
    await Promise.all(
      accountsToDelete.splice(0).map((u) => deleteAccountForTesting(u).catch(() => {})),
    );
  });

  function trackAccount(username: string): void {
    accountsToDelete.push(username);
  }

  it("sends welcome then register returns authOk", async () => {
    const username = uniqueUsername();
    trackAccount(username);

    const client = await openClient(server.port);
    clients.push(client);

    const welcome = await client.nextMessage();
    expect(welcome).toEqual({ type: "welcome", protocol: PROTOCOL_VERSION });

    client.ws.send(JSON.stringify({ type: "register", username, password: PASSWORD }));
    const auth = await client.nextMessage();
    expect(auth).toMatchObject({
      type: "authOk",
      username,
      wins: 0,
      gamesPlayed: 0,
    });
  });

  it("logs in from a second connection", async () => {
    const username = uniqueUsername();
    trackAccount(username);
    await registerAccount(username, PASSWORD);

    const client = await openClient(server.port);
    clients.push(client);
    await client.nextMessage();

    client.ws.send(JSON.stringify({ type: "login", username, password: PASSWORD }));
    const auth = await client.nextMessage();
    expect(auth).toMatchObject({ type: "authOk", username });
  });

  it("getMyStats returns stats from Firestore after login", async () => {
    const username = uniqueUsername();
    trackAccount(username);
    await registerAccount(username, PASSWORD);

    const client = await openClient(server.port);
    clients.push(client);
    await client.nextMessage();

    client.ws.send(JSON.stringify({ type: "login", username, password: PASSWORD }));
    await client.nextMessage();

    client.ws.send(JSON.stringify({ type: "getMyStats" }));
    const stats = await client.nextMessage();
    expect(stats).toEqual({
      type: "myStats",
      username,
      wins: 0,
      gamesPlayed: 0,
    });
  });

  it("rejects createLobby before authentication", async () => {
    const client = await openClient(server.port);
    clients.push(client);
    await client.nextMessage();

    client.ws.send(JSON.stringify({ type: "createLobby" }));
    const err = await client.nextMessage();
    expect(err).toMatchObject({ type: "error", code: "NOT_AUTHENTICATED" });
  });

  it("creates a lobby and lets a second player join", async () => {
    const hostName = uniqueUsername();
    const guestName = uniqueUsername();
    trackAccount(hostName);
    trackAccount(guestName);

    const host = await openClient(server.port);
    const guest = await openClient(server.port);
    clients.push(host, guest);

    await host.nextMessage();
    await guest.nextMessage();

    host.ws.send(JSON.stringify({ type: "register", username: hostName, password: PASSWORD }));
    await host.nextMessage();

    host.ws.send(JSON.stringify({ type: "createLobby" }));
    const created = await host.nextMessage();
    expect(created.type).toBe("lobbyState");
    const gameCode = (created.lobby as { gameCode: string }).gameCode;

    guest.ws.send(JSON.stringify({ type: "register", username: guestName, password: PASSWORD }));
    await guest.nextMessage();

    guest.ws.send(JSON.stringify({ type: "joinLobby", gameCode }));
    const [toHost, toGuest] = await Promise.all([host.nextMessage(), guest.nextMessage()]);

    expect(toHost.type).toBe("lobbyState");
    expect(toGuest.type).toBe("lobbyState");
    const players = (toHost.lobby as { players: Array<{ username: string }> }).players;
    expect(players.map((p) => p.username).sort()).toEqual([hostName, guestName].sort());
  });

  it("rejects createLobby when username does not match session", async () => {
    const username = uniqueUsername();
    trackAccount(username);

    const client = await openClient(server.port);
    clients.push(client);
    await client.nextMessage();

    client.ws.send(JSON.stringify({ type: "register", username, password: PASSWORD }));
    await client.nextMessage();

    client.ws.send(JSON.stringify({ type: "createLobby", username: "someone_else" }));
    const err = await client.nextMessage();
    expect(err).toMatchObject({ type: "error", code: "AUTH_USERNAME_MISMATCH" });
  });

  it("after everyone leaves, the game code is gone", async () => {
    const hostName = uniqueUsername();
    const guestName = uniqueUsername();
    trackAccount(hostName);
    trackAccount(guestName);

    const host = await openClient(server.port);
    const guest = await openClient(server.port);
    clients.push(host, guest);

    await host.nextMessage();
    await guest.nextMessage();

    host.ws.send(JSON.stringify({ type: "register", username: hostName, password: PASSWORD }));
    await host.nextMessage();
    host.ws.send(JSON.stringify({ type: "createLobby" }));
    const created = await host.nextMessage();
    const gameCode = (created.lobby as { gameCode: string }).gameCode;

    guest.ws.send(JSON.stringify({ type: "register", username: guestName, password: PASSWORD }));
    await guest.nextMessage();
    guest.ws.send(JSON.stringify({ type: "joinLobby", gameCode }));
    await Promise.all([host.nextMessage(), guest.nextMessage()]);

    host.ws.send(JSON.stringify({ type: "leaveLobby" }));
    guest.ws.send(JSON.stringify({ type: "leaveLobby" }));
    await Promise.all([closeClient(host.ws), closeClient(guest.ws)]);
    clients.length = 0;

    const joiner = await openClient(server.port);
    clients.push(joiner);
    await joiner.nextMessage();

    const joinerName = uniqueUsername();
    trackAccount(joinerName);
    joiner.ws.send(
      JSON.stringify({ type: "register", username: joinerName, password: PASSWORD }),
    );
    await joiner.nextMessage();

    joiner.ws.send(JSON.stringify({ type: "joinLobby", gameCode }));
    const err = await joiner.nextMessage();
    expect(err).toMatchObject({ type: "error", code: "ROOM_NOT_FOUND" });
  });

  it("host can start the game after two players join", async () => {
    const hostName = uniqueUsername();
    const guestName = uniqueUsername();
    trackAccount(hostName);
    trackAccount(guestName);

    const host = await openClient(server.port);
    const guest = await openClient(server.port);
    clients.push(host, guest);

    await host.nextMessage();
    await guest.nextMessage();

    host.ws.send(JSON.stringify({ type: "register", username: hostName, password: PASSWORD }));
    await host.nextMessage();
    host.ws.send(JSON.stringify({ type: "createLobby" }));
    const created = await host.nextMessage();
    const gameCode = (created.lobby as { gameCode: string }).gameCode;

    guest.ws.send(JSON.stringify({ type: "register", username: guestName, password: PASSWORD }));
    await guest.nextMessage();
    guest.ws.send(JSON.stringify({ type: "joinLobby", gameCode }));
    await Promise.all([host.nextMessage(), guest.nextMessage()]);

    host.ws.send(JSON.stringify({ type: "startGame" }));
    const [h, g] = await Promise.all([host.nextMessage(), guest.nextMessage()]);
    expect(h.type).toBe("gameState");
    expect(g.type).toBe("gameState");
    expect((h.room as { public: { status: string } }).public.status).toBe("InGame");
  });
});
