import { describe, expect, it } from "vitest";
import { assessGiveawayEntry } from "./giveawayRules";

describe("giveaway entry eligibility", () => {
  const base = { giveawayGuildId: "g", requestedGuildId: "g", status: "active" as const, endsAt: new Date(2_000), requiredRoleId: "r", memberRoleIds: new Set(["r"]), minimumLevel: 5, memberLevel: 5, now: 1_000 };
  it("allows an eligible member", () => expect(assessGiveawayEntry(base)).toEqual({ allowed: true }));
  it("rejects closed, role, level, and cross-guild entries", () => {
    expect(assessGiveawayEntry({ ...base, memberRoleIds: new Set() })).toMatchObject({ reason: "required_role" });
    expect(assessGiveawayEntry({ ...base, memberLevel: 4 })).toMatchObject({ reason: "minimum_level" });
    expect(assessGiveawayEntry({ ...base, endsAt: new Date(1_000) })).toMatchObject({ reason: "closed" });
    expect(assessGiveawayEntry({ ...base, requestedGuildId: "other" })).toMatchObject({ reason: "not_found" });
  });
});
