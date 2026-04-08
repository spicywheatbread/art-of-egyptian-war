export interface GameSettings {
  includeJokers: boolean;
  enableTopSlaps: boolean;
  enableBottomSlaps: boolean;
  burnCardsOnBadSlap: number;
  turnTimeLimitMs: number | null;
  enableSlapOnRankMatch?: boolean;
  enableSlapOnSuitMatch?: boolean;
  extraSlapRuleEnabled?: Record<string, boolean>;
}

export function defaultGameSettings(): GameSettings {
  return {
    includeJokers: false,
    enableTopSlaps: true,
    enableBottomSlaps: false,
    burnCardsOnBadSlap: 2,
    turnTimeLimitMs: null,
  };
}

