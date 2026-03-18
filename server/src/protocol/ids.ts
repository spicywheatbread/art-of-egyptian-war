// Shared ID types to keep client/server payloads consistent.

export type Brand<T, B extends string> = T & { readonly __brand: B };

export type PlayerId = Brand<string, "PlayerId">;
export type RoomId = Brand<string, "RoomId">;

export type TimestampMs = number;
export type DurationMs = number;

