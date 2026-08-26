import { describe, expect, it } from "vitest";
import { assessRoleShopPurchase, canUseEconomyAction } from "./economyRules";

describe("community economy rules", () => {
  it("applies per-action cooldowns", () => {
    expect(canUseEconomyAction(1_000, 1_999, 1_000)).toBe(false);
    expect(canUseEconomyAction(1_000, 2_000, 1_000)).toBe(true);
  });
  it("allows only an affordable, manageable, unowned item from the same guild", () => {
    const base = { requestedGuildId: "g", itemGuildId: "g", enabled: true, roleExists: true, roleEditable: true, roleSafe: true, alreadyHasRole: false, balance: 100, cost: 20 };
    expect(assessRoleShopPurchase(base)).toEqual({ allowed: true });
    expect(assessRoleShopPurchase({ ...base, balance: 19 })).toMatchObject({ reason: "insufficient_balance" });
    expect(assessRoleShopPurchase({ ...base, roleEditable: false })).toMatchObject({ reason: "role_unmanageable" });
    expect(assessRoleShopPurchase({ ...base, roleSafe: false })).toMatchObject({ reason: "unsafe_role" });
    expect(assessRoleShopPurchase({ ...base, requestedGuildId: "other" })).toMatchObject({ reason: "not_available" });
  });
});
