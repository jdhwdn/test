import { describe, expect, it } from "vitest";
import { assessEventClose, formatEventRsvpSummary } from "./eventCloseRules";

describe("event closure", () => {
  it("allows closing only a scheduled event in the current guild", () => {
    expect(assessEventClose({ requestedGuildId: "guild-a", eventGuildId: "guild-a", status: "scheduled" })).toEqual({ allowed: true });
    expect(assessEventClose({ requestedGuildId: "guild-a", eventGuildId: "guild-b", status: "scheduled" })).toEqual({ allowed: false, reason: "guild_scope" });
    expect(assessEventClose({ requestedGuildId: "guild-a", eventGuildId: "guild-a", status: "completed" })).toEqual({ allowed: false, reason: "not_scheduled" });
  });
  it("formats RSVP totals without member identities", () => expect(formatEventRsvpSummary([{ state: "going", total: 4 }])).toContain("ذاهب: **4**"));
});
