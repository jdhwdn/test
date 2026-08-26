import { describe, expect, it } from "vitest";
import { assessPollVote } from "./pollRules";

describe("interactive poll vote rules", () => {
  it("accepts only an active matching-guild poll with an existing option", () => {
    expect(assessPollVote({ requestedGuildId: "g", pollGuildId: "g", status: "active", optionExists: true, now: 100 })).toEqual({ allowed: true });
  });
  it("rejects cross-guild, expired, closed, and invalid option votes", () => {
    expect(assessPollVote({ requestedGuildId: "g", pollGuildId: "other", status: "active", optionExists: true, now: 100 })).toMatchObject({ reason: "not_found" });
    expect(assessPollVote({ requestedGuildId: "g", pollGuildId: "g", status: "active", endsAt: new Date(99), optionExists: true, now: 100 })).toMatchObject({ reason: "closed" });
    expect(assessPollVote({ requestedGuildId: "g", pollGuildId: "g", status: "active", optionExists: false, now: 100 })).toMatchObject({ reason: "invalid_option" });
  });
});
