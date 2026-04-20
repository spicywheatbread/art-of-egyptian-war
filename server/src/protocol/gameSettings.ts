/** Inclusive bounds for lobby size and active games (Egyptian War supports 2–4 players). */
export const MIN_PLAYERS_PER_GAME = 2;
export const MAX_PLAYERS_PER_GAME = 4;

export type BurnCardsOnBadSlapSetting = number | "ENTIRE_HAND";

export interface GameSettings {
  includeJokers: boolean;
  enableTopSlaps: boolean;
  enableBottomSlaps: boolean;
  burnCardsOnBadSlap: BurnCardsOnBadSlapSetting;
  turnTimeLimitMs: number | null;
  /** Maximum players allowed in this lobby (2–4). Default 4. */
  maxPlayers: number;
  enableSlapOnRankMatch?: boolean;
  enableSlapOnSuitMatch?: boolean;
  extraSlapRuleEnabled?: Record<string, boolean>;
}

export class InvalidGameSettingsError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "InvalidGameSettingsError";
  }
}

export function defaultGameSettings(): GameSettings {
  return {
    includeJokers: false,
    enableTopSlaps: true,
    enableBottomSlaps: false,
    burnCardsOnBadSlap: 2,
    turnTimeLimitMs: null,
    maxPlayers: MAX_PLAYERS_PER_GAME,
  };
}

export function mergeGameSettings(overrides?: Partial<GameSettings>): GameSettings {
  const merged: GameSettings = { ...defaultGameSettings(), ...overrides };
  if (
    typeof merged.maxPlayers !== "number" ||
    !Number.isInteger(merged.maxPlayers) ||
    merged.maxPlayers < MIN_PLAYERS_PER_GAME ||
    merged.maxPlayers > MAX_PLAYERS_PER_GAME
  ) {
    throw new InvalidGameSettingsError(
      "INVALID_GAME_SETTINGS",
      `maxPlayers must be an integer from ${MIN_PLAYERS_PER_GAME} to ${MAX_PLAYERS_PER_GAME}`,
    );
  }
  if (merged.burnCardsOnBadSlap !== "ENTIRE_HAND") {
    if (
      typeof merged.burnCardsOnBadSlap !== "number" ||
      !Number.isInteger(merged.burnCardsOnBadSlap) ||
      merged.burnCardsOnBadSlap < 0 ||
      merged.burnCardsOnBadSlap > 52
    ) {
      throw new InvalidGameSettingsError(
        "INVALID_GAME_SETTINGS",
        "burnCardsOnBadSlap must be an integer from 0 to 52, or \"ENTIRE_HAND\"",
      );
    }
  } else if (typeof merged.burnCardsOnBadSlap !== "string") {
    throw new InvalidGameSettingsError(
      "INVALID_GAME_SETTINGS",
      "burnCardsOnBadSlap must be an integer from 0 to 52, or \"ENTIRE_HAND\"",
    );
  }
  return merged;
}

