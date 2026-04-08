import type { GameSettings, LobbyRoomState } from "../protocol";

// --- Client → Server ---

export interface CreateLobbyMessage {
  type: "createLobby";
  username: string;
  settings?: Partial<GameSettings>;
}

export interface JoinLobbyMessage {
  type: "joinLobby";
  gameCode: string;
  username: string;
}

export interface LeaveLobbyMessage {
  type: "leaveLobby";
}

export type ClientMessage =
  | CreateLobbyMessage
  | JoinLobbyMessage
  | LeaveLobbyMessage;

// --- Server → Client ---

export interface WelcomeMessage {
  type: "welcome";
  protocol: number;
}

export interface LobbyStateMessage {
  type: "lobbyState";
  lobby: LobbyRoomState;
}

export interface ErrorMessage {
  type: "error";
  code: string;
  message: string;
}

export type ServerMessage = WelcomeMessage | LobbyStateMessage | ErrorMessage;

// --- Parsing ---

const CLIENT_TYPES = new Set<string>(["createLobby", "joinLobby", "leaveLobby"]);

export function parseClientMessage(raw: string): ClientMessage {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ParseError("INVALID_JSON", "Message is not valid JSON");
  }

  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    throw new ParseError("INVALID_PAYLOAD", "Payload must be a JSON object");
  }

  const obj = json as Record<string, unknown>;

  if (typeof obj.type !== "string" || !CLIENT_TYPES.has(obj.type)) {
    throw new ParseError("UNKNOWN_TYPE", `Unknown message type: ${String(obj.type)}`);
  }

  if (obj.type === "createLobby" || obj.type === "joinLobby") {
    if (typeof obj.username !== "string" || obj.username.trim().length === 0) {
      throw new ParseError("INVALID_USERNAME", "username must be a non-empty string");
    }
  }

  if (obj.type === "joinLobby") {
    if (typeof obj.gameCode !== "string" || !/^\d{4}$/.test(obj.gameCode)) {
      throw new ParseError("INVALID_GAME_CODE", "gameCode must be a 4-digit string");
    }
  }

  return obj as unknown as ClientMessage;
}

export class ParseError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ParseError";
  }
}
