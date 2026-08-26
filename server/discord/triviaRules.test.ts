import { describe, expect, it } from "vitest";
import { assessTriviaAnswer, selectTriviaQuestion } from "./triviaRules";

describe("trivia rules", () => {
  const question = selectTriviaQuestion("guild-a:member-a");
  const pending = { guildId: "guild-a", actorId: "member-a", question, expiresAt: 2_000 };
  it("selects a deterministic local question and accepts the owner answer", () => {
    expect(selectTriviaQuestion("guild-a:member-a")).toEqual(question);
    expect(assessTriviaAnswer({ pending, guildId: "guild-a", actorId: "member-a", optionIndex: question.correctIndex, now: 1_000 })).toMatchObject({ allowed: true, correct: true });
  });
  it("rejects cross-guild, another member, expired, and malformed answers", () => {
    expect(assessTriviaAnswer({ pending, guildId: "guild-b", actorId: "member-a", optionIndex: 0, now: 1_000 })).toEqual({ allowed: false, reason: "not_found" });
    expect(assessTriviaAnswer({ pending, guildId: "guild-a", actorId: "member-b", optionIndex: 0, now: 1_000 })).toEqual({ allowed: false, reason: "not_owner" });
    expect(assessTriviaAnswer({ pending, guildId: "guild-a", actorId: "member-a", optionIndex: 0, now: 2_000 })).toEqual({ allowed: false, reason: "expired" });
  });
});
