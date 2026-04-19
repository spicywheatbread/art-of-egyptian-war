import type { PlayerId } from "./ids";
import type { Card } from "./card";

export interface UserProfile {
  playerId: PlayerId;
  username: string;
}

export interface InGamePlayer extends UserProfile {
    hand: Card[];
}

export interface PublicInGamePlayer extends UserProfile {
    hand_count: number;
}

export interface PlayerStats {
  playerId: PlayerId;

  // Slap stats
  successfulSlaps: number;
  unsuccessfulSlaps: number;
  totalSlaps: number;

  // Timing/engagement stats
  gamesPlayed: number;
  longestGameMs: number | null;
}

export interface GameStatistics {
  winnerPlayerId: PlayerId | null;
  mostSuccessfulSlapsPlayerId: PlayerId | null;
  leastSlapsPlayerId: PlayerId | null;
  longestGameInSessionPlayerId: PlayerId | null;

  players: PlayerStats[];
}

