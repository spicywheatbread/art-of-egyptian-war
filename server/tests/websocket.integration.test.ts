import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROTOCOL_VERSION, type RunningServer, startServer } from "../src/index";
import { closeClient, type TestClient, openClient } from "./helpers/wsClient";

const registerMock = vi.fn(
  async (username: string) => ({ username, wins: 0, gamesPlayed: 0 }) as const,
);
const loginMock = vi.fn(async (username: string) => ({ username, wins: 3, gamesPlayed: 10 }));
const recordOutcomeMock = vi.fn(async (username: string, didWin: boolean) => ({
  username,
  wins: didWin ? 4 : 3,
  gamesPlayed: 11,
}));
const getAccountStatsMock = vi.fn(async (username: string) => ({
  username,
  wins: 7,
  gamesPlayed: 21,
}));

describe("WebSocket server integration", () => {
  let server: RunningServer;
  const clients: TestClient[] = [];

  beforeEach(async () => {
    registerMock.mockClear();
    loginMock.mockClear();
    recordOutcomeMock.mockClear();
    getAccountStatsMock.mockClear();
    server = await startServer({
      port: 0,
      enableDevRecordOutcome: false,
      accounts: {
        registerAccount: registerMock,
        loginAccount: loginMock,
        getAccountStats: getAccountStatsMock,
        recordGameOutcome: recordOutcomeMock,
      },
    });
  });

  afterEach(async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await Promise.all(clients.map((client) => closeClient(client.ws)));
    clients.length = 0;
    await server.close();
    warn.mockRestore();
  });

  it("sends welcome on connect", async () => {
    const client = await openClient(server.port);
    clients.push(client);

    const welcome = await client.nextMessage();

    expect(welcome).toEqual({
      type: "welcome",
      protocol: PROTOCOL_VERSION,
    });
  });

  it("rejects getMyStats before authentication", async () => {
    const client = await openClient(server.port);
    clients.push(client);
    await client.nextMessage();

    client.ws.send(JSON.stringify({ type: "getMyStats" }));
    const response = await client.nextMessage();

    expect(response.type).toBe("error");
    expect(response.code).toBe("NOT_AUTHENTICATED");
    expect(getAccountStatsMock).not.toHaveBeenCalled();
  });

  it("returns myStats after authentication", async () => {
    const client = await openClient(server.port);
    clients.push(client);
    await client.nextMessage();

    client.ws.send(
      JSON.stringify({
        type: "register",
        username: "Alice",
        password: "secret123",
      }),
    );
    await client.nextMessage();

    client.ws.send(JSON.stringify({ type: "getMyStats" }));
    const stats = await client.nextMessage();

    expect(stats).toEqual({
      type: "myStats",
      username: "Alice",
      wins: 7,
      gamesPlayed: 21,
    });
    expect(getAccountStatsMock).toHaveBeenCalledWith("Alice");
  });

  it("rejects lobby actions before authentication", async () => {
    const client = await openClient(server.port);
    clients.push(client);
    await client.nextMessage(); // welcome

    client.ws.send(JSON.stringify({ type: "createLobby" }));
    const response = await client.nextMessage();

    expect(response.type).toBe("error");
    expect(response.code).toBe("NOT_AUTHENTICATED");
  });

  it("authenticates register and creates a lobby", async () => {
    const client = await openClient(server.port);
    clients.push(client);
    await client.nextMessage(); // welcome

    client.ws.send(
      JSON.stringify({
        type: "register",
        username: "Alice",
        password: "secret123",
      }),
    );
    const auth = await client.nextMessage();
    expect(auth).toMatchObject({
      type: "authOk",
      username: "Alice",
      wins: 0,
      gamesPlayed: 0,
    });

    client.ws.send(JSON.stringify({ type: "createLobby" }));
    const lobby = await client.nextMessage();

    expect(lobby.type).toBe("lobbyState");
    expect((lobby.lobby as { players: Array<{ username: string }> }).players[0]?.username).toBe(
      "Alice",
    );
  });

  it("rejects mismatched username after authentication", async () => {
    const client = await openClient(server.port);
    clients.push(client);
    await client.nextMessage(); // welcome

    client.ws.send(
      JSON.stringify({
        type: "register",
        username: "Alice",
        password: "secret123",
      }),
    );
    await client.nextMessage(); // authOk

    client.ws.send(
      JSON.stringify({
        type: "createLobby",
        username: "Bob",
      }),
    );
    const response = await client.nextMessage();

    expect(response.type).toBe("error");
    expect(response.code).toBe("AUTH_USERNAME_MISMATCH");
  });

  it("broadcasts updated lobby state to both clients on join", async () => {
    const host = await openClient(server.port);
    const guest = await openClient(server.port);
    clients.push(host, guest);

    await host.nextMessage(); // welcome
    await guest.nextMessage(); // welcome

    host.ws.send(
      JSON.stringify({
        type: "register",
        username: "Alice",
        password: "secret123",
      }),
    );
    await host.nextMessage(); // authOk

    host.ws.send(JSON.stringify({ type: "createLobby" }));
    const hostLobby = await host.nextMessage();
    const gameCode = (hostLobby.lobby as { gameCode: string }).gameCode;

    guest.ws.send(
      JSON.stringify({
        type: "register",
        username: "Bob",
        password: "secret123",
      }),
    );
    await guest.nextMessage(); // authOk

    guest.ws.send(JSON.stringify({ type: "joinLobby", gameCode }));
    const [hostUpdate, guestUpdate] = await Promise.all([host.nextMessage(), guest.nextMessage()]);

    expect(hostUpdate.type).toBe("lobbyState");
    expect(guestUpdate.type).toBe("lobbyState");

    const hostPlayers = (hostUpdate.lobby as { players: Array<{ username: string }> }).players;
    const guestPlayers = (guestUpdate.lobby as { players: Array<{ username: string }> }).players;

    expect(hostPlayers).toHaveLength(2);
    expect(guestPlayers).toHaveLength(2);
    expect(hostPlayers.map((p) => p.username)).toEqual(["Alice", "Bob"]);
  });

  it("broadcasts a three-player lobby to all members after each join", async () => {
    const host = await openClient(server.port);
    const g1 = await openClient(server.port);
    const g2 = await openClient(server.port);
    clients.push(host, g1, g2);

    for (const c of [host, g1, g2]) {
      await c.nextMessage();
    }

    host.ws.send(
      JSON.stringify({
        type: "register",
        username: "Alice",
        password: "secret123",
      }),
    );
    await host.nextMessage();
    host.ws.send(JSON.stringify({ type: "createLobby" }));
    const created = await host.nextMessage();
    const gameCode = (created.lobby as { gameCode: string }).gameCode;

    g1.ws.send(
      JSON.stringify({
        type: "register",
        username: "Bob",
        password: "secret123",
      }),
    );
    await g1.nextMessage();
    g1.ws.send(JSON.stringify({ type: "joinLobby", gameCode }));
    await Promise.all([host.nextMessage(), g1.nextMessage()]);

    g2.ws.send(
      JSON.stringify({
        type: "register",
        username: "Carol",
        password: "secret123",
      }),
    );
    await g2.nextMessage();
    g2.ws.send(JSON.stringify({ type: "joinLobby", gameCode }));

    const [hMsg, bMsg, cMsg] = await Promise.all([
      host.nextMessage(),
      g1.nextMessage(),
      g2.nextMessage(),
    ]);

    for (const m of [hMsg, bMsg, cMsg]) {
      expect(m.type).toBe("lobbyState");
      const players = (m.lobby as { players: Array<{ username: string }> }).players;
      expect(players).toHaveLength(3);
      expect(players.map((p) => p.username).sort()).toEqual(["Alice", "Bob", "Carol"]);
    }
  });

  it("rejects join when the lobby already has four players", async () => {
    const sockets = await Promise.all([
      openClient(server.port),
      openClient(server.port),
      openClient(server.port),
      openClient(server.port),
      openClient(server.port),
    ]);
    clients.push(...sockets);

    for (const c of sockets) {
      await c.nextMessage();
    }

    sockets[0].ws.send(
      JSON.stringify({
        type: "register",
        username: "Alice",
        password: "secret123",
      }),
    );
    await sockets[0].nextMessage();
    sockets[0].ws.send(JSON.stringify({ type: "createLobby" }));
    const created = await sockets[0].nextMessage();
    const gameCode = (created.lobby as { gameCode: string }).gameCode;

    const joiners = ["Bob", "Carol", "Dave"] as const;
    for (let i = 0; i < joiners.length; i++) {
      const client = sockets[i + 1];
      client.ws.send(
        JSON.stringify({
          type: "register",
          username: joiners[i],
          password: "secret123",
        }),
      );
      await client.nextMessage();
      client.ws.send(JSON.stringify({ type: "joinLobby", gameCode }));
      await Promise.all(sockets.slice(0, i + 2).map((c) => c.nextMessage()));
    }

    sockets[4].ws.send(
      JSON.stringify({
        type: "register",
        username: "Eve",
        password: "secret123",
      }),
    );
    await sockets[4].nextMessage();
    sockets[4].ws.send(JSON.stringify({ type: "joinLobby", gameCode }));
    const err = await sockets[4].nextMessage();

    expect(err.type).toBe("error");
    expect(err.code).toBe("LOBBY_FULL");
  });

  it("starts a four-player game with 13 cards per hand", async () => {
    const sockets = await Promise.all([
      openClient(server.port),
      openClient(server.port),
      openClient(server.port),
      openClient(server.port),
    ]);
    clients.push(...sockets);

    for (const c of sockets) {
      await c.nextMessage();
    }

    const names = ["Alice", "Bob", "Carol", "Dave"] as const;
    sockets[0].ws.send(
      JSON.stringify({
        type: "register",
        username: names[0],
        password: "secret123",
      }),
    );
    await sockets[0].nextMessage();
    sockets[0].ws.send(JSON.stringify({ type: "createLobby" }));
    const created = await sockets[0].nextMessage();
    const gameCode = (created.lobby as { gameCode: string }).gameCode;

    for (let i = 1; i < 4; i++) {
      sockets[i].ws.send(
        JSON.stringify({
          type: "register",
          username: names[i],
          password: "secret123",
        }),
      );
      await sockets[i].nextMessage();
      sockets[i].ws.send(JSON.stringify({ type: "joinLobby", gameCode }));
      await Promise.all(sockets.slice(0, i + 1).map((c) => c.nextMessage()));
    }

    sockets[0].ws.send(JSON.stringify({ type: "startGame" }));
    type GameStateMsg = {
      public: { status: string };
      private: { handCards: unknown[] } | null;
    };
    const messages = await Promise.all(sockets.map((c) => c.nextMessage()));
    for (const m of messages) {
      expect(m.type).toBe("gameState");
      const room = m.room as GameStateMsg;
      expect(room.public.status).toBe("InGame");
      expect(room.private?.handCards.length).toBe(13);
    }
  });

  it("rejects recordOutcome when dev hook is disabled", async () => {
    const client = await openClient(server.port);
    clients.push(client);
    await client.nextMessage(); // welcome

    client.ws.send(
      JSON.stringify({
        type: "register",
        username: "Alice",
        password: "secret123",
      }),
    );
    await client.nextMessage(); // authOk

    client.ws.send(JSON.stringify({ type: "recordOutcome", didWin: true }));
    const response = await client.nextMessage();

    expect(response.type).toBe("error");
    expect(response.code).toBe("FEATURE_DISABLED");
    expect(recordOutcomeMock).not.toHaveBeenCalled();
  });

  it("sends InGame gameState to both players when host starts", async () => {
    const host = await openClient(server.port);
    const guest = await openClient(server.port);
    clients.push(host, guest);

    await host.nextMessage();
    await guest.nextMessage();

    host.ws.send(
      JSON.stringify({
        type: "register",
        username: "Alice",
        password: "secret123",
      }),
    );
    await host.nextMessage();
    host.ws.send(JSON.stringify({ type: "createLobby" }));
    const created = await host.nextMessage();
    expect(created.type).toBe("lobbyState");
    const gameCode = (created.lobby as { gameCode: string }).gameCode;

    guest.ws.send(
      JSON.stringify({
        type: "register",
        username: "Bob",
        password: "secret123",
      }),
    );
    await guest.nextMessage();
    guest.ws.send(JSON.stringify({ type: "joinLobby", gameCode }));

    await Promise.all([host.nextMessage(), guest.nextMessage()]);

    host.ws.send(JSON.stringify({ type: "startGame" }));
    const [toHost, toGuest] = await Promise.all([host.nextMessage(), guest.nextMessage()]);

    expect(toHost.type).toBe("gameState");
    expect(toGuest.type).toBe("gameState");
    type GameStateMsg = {
      public: { status: string };
      private: { handCards: unknown[] } | null;
    };
    const roomH = toHost.room as GameStateMsg;
    const roomG = toGuest.room as GameStateMsg;
    expect(roomH.public.status).toBe("InGame");
    expect(roomG.public.status).toBe("InGame");
    expect(roomH.private?.handCards.length).toBe(26);
    expect(roomG.private?.handCards.length).toBe(26);
  });

  it("broadcasts updated gameState after playCard and slap", async () => {
    const host = await openClient(server.port);
    const guest = await openClient(server.port);
    clients.push(host, guest);

    await host.nextMessage();
    await guest.nextMessage();

    host.ws.send(
      JSON.stringify({
        type: "register",
        username: "Alice",
        password: "secret123",
      }),
    );
    await host.nextMessage();
    host.ws.send(JSON.stringify({ type: "createLobby" }));
    const created = await host.nextMessage();
    const gameCode = (created.lobby as { gameCode: string }).gameCode;

    guest.ws.send(
      JSON.stringify({
        type: "register",
        username: "Bob",
        password: "secret123",
      }),
    );
    await guest.nextMessage();
    guest.ws.send(JSON.stringify({ type: "joinLobby", gameCode }));

    await Promise.all([host.nextMessage(), guest.nextMessage()]);

    host.ws.send(JSON.stringify({ type: "startGame" }));
    const [startHost] = await Promise.all([host.nextMessage(), guest.nextMessage()]);
    type Snapshot = { private: { handCards: unknown[] } | null };
    const handBefore = (startHost.room as Snapshot).private?.handCards.length ?? 0;

    host.ws.send(JSON.stringify({ type: "playCard" }));
    const [afterPlayHost] = await Promise.all([host.nextMessage(), guest.nextMessage()]);
    expect(afterPlayHost.type).toBe("gameState");
    expect((afterPlayHost.room as Snapshot).private?.handCards.length).toBe(handBefore - 1);

    guest.ws.send(JSON.stringify({ type: "slap" }));
    const [afterSlapHost, afterSlapGuest] = await Promise.all([host.nextMessage(), guest.nextMessage()]);
    expect(afterSlapHost.type).toBe("gameState");
    expect(afterSlapGuest.type).toBe("gameState");
  });
});
