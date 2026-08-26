import { describe, expect, it } from "vitest";
import { assessPollClose, formatPollResults } from "./pollCloseRules";

describe("poll closure", () => {
  it("allows only an active poll in the current guild", () => {
    expect(assessPollClose({ requestedGuildId: "guild-a", pollGuildId: "guild-a", status: "active" })).toEqual({ allowed: true });
    expect(assessPollClose({ requestedGuildId: "guild-a", pollGuildId: "guild-b", status: "active" })).toEqual({ allowed: false, reason: "guild_scope" });
    expect(assessPollClose({ requestedGuildId: "guild-a", pollGuildId: "guild-a", status: "closed" })).toEqual({ allowed: false, reason: "not_active" });
  });
  it("formats aggregate results without voter identities", () => expect(formatPollResults([{ label: "نعم", position: 0, votes: 2 }, { label: "لا", position: 1, votes: 1 }])).toContain("67%"));
});
