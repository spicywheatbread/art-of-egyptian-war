import type { Card } from "./card";
import type { GameSettings } from "./gameSettings";
import type { PlayerId, RoomId, TimestampMs } from "./ids";
import type { GameStatistics, UserProfile } from "./user";
import type { PublicInGamePlayer } from "./user"

export type RoomStatus = "Lobby" | "InGame" | "GameOver";

export interface LobbyRoomState {
  status: "Lobby";
  roomId: RoomId;
  gameCode: string;
  hostPlayerId: PlayerId;
  players: UserProfile[];
  settings: GameSettings;
  createdAtMs: TimestampMs;
}

export interface TurnState {
  currentPlayerId: PlayerId | null;
  turnStartedAtMs: TimestampMs | null;
  turnEndsAtMs: TimestampMs | null;
}

export interface PlayedCardEvent {
  type: "playCard";
  atMs: TimestampMs;
  byPlayerId: PlayerId;
  card: Card;
}

export interface DragEvent {
    type: "dragCard";
    atMs: TimestampMs;
    globalPosition: Vec2;
}
export interface SlapEvent {
  type: "slap";
  atMs: TimestampMs;
  byPlayerId: PlayerId;
  // Whether the slap condition matched the game rules.
  wasSuccessful: boolean;
  // If a slap is wrong, the server will burn/remove a configured number of cards.
  burnedCount: number;
}

export interface Vec2 {
    x: number;
    y: number;
}
export interface StartGameEvent {
    type: "startGame";
    atMs: TimestampMs;
    byPlayerId: PlayerId;
}

export type LastActionEvent = PlayedCardEvent | SlapEvent | StartGameEvent | DragEvent;

export interface PublicGameRoomState {
  status: "InGame";
  roomId: RoomId;
  players: PublicInGamePlayer[];
  hostPlayerId: PlayerId;
  settings: GameSettings;

  turn: TurnState;

  pileCards: Card[];
  // Optional explicit top/bottom for client convenience.
  pileTopCard?: Card;
  pileBottomCard?: Card;

  drawPileRemainingCount: number;
  burnedCardsOnBadSlapCount: number;
  remainingChancesToFlipRoyal: number; // -1 if N/A

  lastAction?: LastActionEvent;
  gameStartedAtMs: TimestampMs | null;
}

export interface GameOverRoomState {
  status: "GameOver";
  roomId: RoomId;
  players: UserProfile[];
  hostPlayerId: PlayerId;
  settings: GameSettings;
  endedAtMs: TimestampMs;
  gameStartedAtMs: TimestampMs | null;
  finalStats: GameStatistics;
  lastAction?: LastActionEvent;
}

export type RoomState = LobbyRoomState | PublicGameRoomState | GameOverRoomState;

// Convenience snapshot shape for "send to a given player".
export interface RoomSnapshotForPlayer {
  public: PublicGameRoomState | LobbyRoomState | GameOverRoomState;
}

