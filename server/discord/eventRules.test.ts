import { describe, expect, it } from "vitest";
import { assessEventRsvp } from "./eventRules";

describe("event RSVP rules", () => {
  it("allows approved RSVP states only for a scheduled event in the same guild", () => expect(assessEventRsvp({ requestedGuildId: "g", eventGuildId: "g", status: "scheduled", state: "going" })).toEqual({ allowed: true }));
  it("rejects cross-guild, closed, and malformed RSVPs", () => {
    expect(assessEventRsvp({ requestedGuildId: "g", eventGuildId: "other", status: "scheduled", state: "going" })).toMatchObject({ reason: "not_found" });
    expect(assessEventRsvp({ requestedGuildId: "g", eventGuildId: "g", status: "cancelled", state: "going" })).toMatchObject({ reason: "closed" });
    expect(assessEventRsvp({ requestedGuildId: "g", eventGuildId: "g", status: "scheduled", state: "all" })).toMatchObject({ reason: "invalid_state" });
  });
});
