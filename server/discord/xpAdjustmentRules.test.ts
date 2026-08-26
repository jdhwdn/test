import { describe, expect, it } from "vitest";
import { canApplyXpAdjustment, normalizeXpAdjustment } from "./xpAdjustmentRules";

describe("XP adjustment limits", () => {
  it("preserves valid integer changes and rejects zero changes", () => {
    expect(normalizeXpAdjustment(250)).toBe(250);
    expect(canApplyXpAdjustment(0)).toBe(false);
  });

  it("clamps malformed or excessive changes to the configured safe range", () => {
    expect(normalizeXpAdjustment(9_999_999)).toBe(1_000_000);
    expect(normalizeXpAdjustment(-9_999_999)).toBe(-1_000_000);
    expect(normalizeXpAdjustment(Number.NaN)).toBe(0);
  });
});
