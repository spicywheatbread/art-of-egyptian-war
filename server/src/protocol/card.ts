export enum Suit {
  SPADES = 0,
  HEARTS = 1,
  DIAMONDS = 2,
  CLUBS = 3,
}

export enum Rank {
  ACE = 1,
  TWO = 2,
  THREE = 3,
  FOUR = 4,
  FIVE = 5,
  SIX = 6,
  SEVEN = 7,
  EIGHT = 8,
  NINE = 9,
  TEN = 10,
  JACK = 11,
  QUEEN = 12,
  KING = 13,
}

// Must stay compatible with `Assets/Scripts/card.gd`:
// - `setup(rank: Rank, suit: Suit)` requires both fields to be present.
export interface Card {
  suit: Suit;
  rank: Rank;
  // Used to disambiguate duplicates and support future joker instances.
  instanceId?: string;
  // Optional marker for game logic/UI. Godot card scene may ignore this for now.
  isJoker?: boolean;
}

