/** Inclusive bounds for lobby size and active games (Egyptian War supports 2–4 players). */
export const MIN_PLAYERS_PER_GAME = 2;
export const MAX_PLAYERS_PER_GAME = 4;

export interface GameSettings {
  includeJokers: boolean;
  enableTopSlaps: boolean;
  enableBottomSlaps: boolean;
  burnCardsOnBadSlap: number;
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
  return merged;
}

