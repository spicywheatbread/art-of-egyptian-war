import { describe, expect, it } from "vitest";
import { ParseError, parseClientMessage } from "../src/lobby/messages";

describe("parseClientMessage", () => {
  it("parses a valid register message", () => {
    const message = parseClientMessage(
      JSON.stringify({
        type: "register",
        username: "Alice_1",
        password: "secret123",
      }),
    );

    expect(message).toEqual({
      type: "register",
      username: "Alice_1",
      password: "secret123",
    });
  });

  it("rejects invalid JSON", () => {
    expect(() => parseClientMessage("{bad-json")).toThrowError(ParseError);
    expect(() => parseClientMessage("{bad-json")).toThrowError(
      expect.objectContaining({ code: "INVALID_JSON" }),
    );
  });

  it("rejects unknown message type", () => {
    expect(() =>
      parseClientMessage(JSON.stringify({ type: "somethingElse" })),
    ).toThrowError(expect.objectContaining({ code: "UNKNOWN_TYPE" }));
  });

  it("rejects joinLobby with invalid gameCode", () => {
    expect(() =>
      parseClientMessage(
        JSON.stringify({
          type: "joinLobby",
          gameCode: "12ab",
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: "INVALID_GAME_CODE" }));
  });

  it("rejects recordOutcome with non-boolean didWin", () => {
    expect(() =>
      parseClientMessage(
        JSON.stringify({
          type: "recordOutcome",
          didWin: "yes",
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: "INVALID_DID_WIN" }));
  });
});
