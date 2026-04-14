import WebSocket from "ws";

export interface JsonMessage {
  type: string;
  [key: string]: unknown;
}

export interface TestClient {
  ws: WebSocket;
  nextMessage(timeoutMs?: number): Promise<JsonMessage>;
}

export function openClient(port: number): Promise<TestClient> {
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

export function closeClient(ws: WebSocket): Promise<void> {
  if (ws.readyState === WebSocket.CLOSED) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    ws.once("close", () => resolve());
    ws.close();
  });
}
