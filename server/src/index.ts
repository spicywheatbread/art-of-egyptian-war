import WebSocket, { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT ?? 8080);

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (socket) => {
  socket.send(JSON.stringify({ type: "hello", server: "ok" }));

  socket.on("message", (data) => {
    // Echo back what Godot sends
    socket.send(data.toString());
  });
});

console.log(`WebSocket server listening on ws://localhost:${PORT}`);
