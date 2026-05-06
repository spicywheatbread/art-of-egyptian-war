import type { GameSettings, LobbyRoomState, RoomSnapshotForPlayer, Vec2 } from "../protocol";

// --- Client → Server ---

export interface CreateLobbyMessage {
  type: "createLobby";
  username?: string;
  settings?: Partial<GameSettings>;
}

export interface JoinLobbyMessage {
  type: "joinLobby";
  gameCode: string;
  username?: string;
}

export interface LeaveLobbyMessage {
  type: "leaveLobby";
}

export interface RegisterMessage {
  type: "register";
  username: string;
  password: string;
}

export interface LoginMessage {
  type: "login";
  username: string;
  password: string;
}

export interface GetMyStatsMessage {
  type: "getMyStats";
}

export interface RecordOutcomeMessage {
  type: "recordOutcome";
  didWin: boolean;
}

export interface StartGameMessage {
  type: "startGame";
  username: string; 
}

export interface PlayCardMessage {
  type: "playCard";
  username: string;
  global_position: Vec2;
}

export interface SlapMessage {
  type: "slap";
  username: string;   
}

export interface DragMessage {
    type: "drag";
    global_position: Vec2;
}

export interface SendChatMessage {
  type: "sendChat";
  emoji_number: number;
}

export type ClientMessage =
  | CreateLobbyMessage
  | JoinLobbyMessage
  | LeaveLobbyMessage
  | RegisterMessage
  | LoginMessage
  | GetMyStatsMessage
  | RecordOutcomeMessage
  | StartGameMessage
  | PlayCardMessage
  | SlapMessage
  | DragMessage
  | SendChatMessage;

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

export interface AuthOkMessage {
  type: "authOk";
  username: string;
  wins: number;
  gamesPlayed: number;
}

export interface MyStatsMessage {
  type: "myStats";
  username: string;
  wins: number;
  gamesPlayed: number;
}

export interface GameStateMessage {
  type: "gameState";
  room: RoomSnapshotForPlayer;
}

export type ServerMessage =
  | WelcomeMessage
  | LobbyStateMessage
  | ErrorMessage
  | AuthOkMessage
  | MyStatsMessage
  | GameStateMessage;

// --- Parsing ---

const CLIENT_TYPES = new Set<string>([
  "createLobby",
  "joinLobby",
  "leaveLobby",
  "register",
  "login",
  "getMyStats",
  "recordOutcome",
  "startGame", // TODO mention i added this 
  "playCard", 
  "slap",
  "drag",
  "sendChat"
]);

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

  if (
    (obj.type === "createLobby" ||
      obj.type === "joinLobby" ||
      obj.type === "startGame" ||
      obj.type === "playCard" ||
      obj.type === "slap") &&
    obj.username !== undefined
  ) {
    if (typeof obj.username !== "string" || obj.username.trim().length === 0) {
      throw new ParseError(
        "INVALID_USERNAME",
        "username must be a non-empty string when provided",
      );
    }
  }

  if (obj.type === "joinLobby") {
    if (typeof obj.gameCode !== "string" || !/^\d{4}$/.test(obj.gameCode)) {
      throw new ParseError("INVALID_GAME_CODE", "gameCode must be a 4-digit string");
    }
  }

  if (obj.type === "register" || obj.type === "login") {
    if (typeof obj.username !== "string" || obj.username.trim().length === 0) {
      throw new ParseError("INVALID_USERNAME", "username must be a non-empty string");
    }
    if (typeof obj.password !== "string" || obj.password.length === 0) {
      throw new ParseError("INVALID_PASSWORD", "password must be a non-empty string");
    }
  }

  if (obj.type === "recordOutcome") {
    if (typeof obj.didWin !== "boolean") {
      throw new ParseError("INVALID_DID_WIN", "didWin must be a boolean");
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
