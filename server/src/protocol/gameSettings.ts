export interface GameSettings {
  // Lobby/game rules
  includeJokers: boolean;
  enableTopSlaps: boolean;
  enableBottomSlaps: boolean;

  // How punishing a bad slap is (burn/remove N cards from the pile).
  burnCardsOnBadSlap: number;

  // Null means no timer enforced.
  turnTimeLimitMs: number | null;

  // Optional additional rules toggled by checkboxes.
  enableSlapOnRankMatch?: boolean;
  enableSlapOnSuitMatch?: boolean;
  extraSlapRuleEnabled?: Record<string, boolean>;
}

