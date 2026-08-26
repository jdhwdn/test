import { describe, expect, it } from "vitest";
import { detectAutoModRule, detectLink, renderLevelUpMessage, updateWindow } from "./communityRules";

describe("community protection rules", () => {
  it("detects links and configured keyword rules without retaining content", () => {
    expect(detectLink("زور https://example.com")).toBe(true);
    expect(detectAutoModRule("هذا نص ممنوع", { type: "keyword", pattern: "ممنوع,إساءة", action: "warn" })).toEqual({ matched: true, action: "warn", reason: "Blocked keyword: ممنوع" });
  });

  it("uses a bounded time window for anti-spam and anti-raid thresholds", () => {
    expect(updateWindow([1_000, 2_000], 3_000, 10, 3).triggered).toBe(true);
    expect(updateWindow([1_000], 20_000, 10, 3).active).toEqual([20_000]);
  });

  it("renders only supported level-up placeholders", () => {
    expect(renderLevelUpMessage("{user} L{level} XP {xp}", { user: "@A", level: 4, xp: 1600 })).toBe("@A L4 XP 1600");
  });
});
