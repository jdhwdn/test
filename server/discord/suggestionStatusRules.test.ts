import { describe, expect, it } from "vitest";
import { assessSuggestionStatusUpdate } from "./suggestionStatusRules";

describe("suggestion status updates", () => {
  it("allows one valid decision inside the same guild", () => expect(assessSuggestionStatusUpdate({ suggestionGuildId: "guild-a", requestedGuildId: "guild-a", currentStatus: "open", requestedStatus: "accepted" })).toEqual({ allowed: true, status: "accepted" }));
  it("rejects cross-guild, repeated, and unsupported decisions", () => {
    expect(assessSuggestionStatusUpdate({ suggestionGuildId: "guild-a", requestedGuildId: "guild-b", currentStatus: "open", requestedStatus: "accepted" })).toEqual({ allowed: false, reason: "guild_scope" });
    expect(assessSuggestionStatusUpdate({ suggestionGuildId: "guild-a", requestedGuildId: "guild-a", currentStatus: "declined", requestedStatus: "accepted" })).toEqual({ allowed: false, reason: "already_decided" });
    expect(assessSuggestionStatusUpdate({ suggestionGuildId: "guild-a", requestedGuildId: "guild-a", currentStatus: "open", requestedStatus: "open" })).toEqual({ allowed: false, reason: "invalid_status" });
  });
});
