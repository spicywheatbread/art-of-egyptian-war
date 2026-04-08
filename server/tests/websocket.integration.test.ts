import WebSocket from "ws";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROTOCOL_VERSION, type RunningServer, startServer } from "../src/index";

interface JsonMessage {
  type: string;
  [key: string]: unknown;
}

const registerMock = vi.fn(
  async (username: string) => ({ username, wins: 0, gamesPlayed: 0 }) as const,
);
const loginMock = vi.fn(async (username: string) => ({ username, wins: 3, gamesPlayed: 10 }));
const recordOutcomeMock = vi.fn(async (username: string, didWin: boolean) => ({
  username,
  wins: didWin ? 4 : 3,
  gamesPlayed: 11,
}));

interface TestClient {
  ws: WebSocket;
  nextMessage(timeoutMs?: number): Promise<JsonMessage>;
}

function openClient(port: number): Promise<TestClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const queue: JsonMessage[] = [];
    let waitingResolver: ((msg: JsonMessage) => void) | null = null;

    ws.on("message", (raw) => {
      const parsed = JSON.parse(raw.toString()) as JsonMessage;
      if (waitingResolver) {
        const resolver = waitingResolver;
        waitingResolver = null;
        resolver(parsed);
        return;
      }
      queue.push(parsed);
    });

    ws.once("open", () =>
      resolve({
        ws,
        nextMessage: (timeoutMs = 2000) =>
          new Promise((resolveNext, rejectNext) => {
            if (queue.length > 0) {
              const next = queue.shift();
              if (next) {
                resolveNext(next);
                return;
              }
            }

            const timer = setTimeout(() => {
              waitingResolver = null;
              rejectNext(new Error("Timed out waiting for websocket message"));
            }, timeoutMs);

            waitingResolver = (msg) => {
              clearTimeout(timer);
              resolveNext(msg);
            };
          }),
      }),
    );
    ws.once("error", (err) => reject(err));
  });
}

function closeClient(ws: WebSocket): Promise<void> {
  if (ws.readyState === WebSocket.CLOSED) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    ws.once("close", () => resolve());
    ws.close();
  });
}

describe("WebSocket server integration", () => {
  let server: RunningServer;
  const clients: TestClient[] = [];

  beforeEach(async () => {
    registerMock.mockClear();
    loginMock.mockClear();
    recordOutcomeMock.mockClear();
    server = await startServer({
      port: 0,
      enableDevRecordOutcome: false,
      accounts: {
        registerAccount: registerMock,
        loginAccount: loginMock,
        recordGameOutcome: recordOutcomeMock,
      },
    });
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => closeClient(client.ws)));
    await server.close();
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
});
