import type { Timestamp } from "firebase-admin/firestore";

export interface AccountStats {
  username: string;
  wins: number;
  gamesPlayed: number;
}

export interface AccountDocument {
  username: string;
  passwordHash: string;
  wins: number;
  gamesPlayed: number;
  createdAt?: Timestamp;
}
