import { describe, expect, it } from "vitest";
import { formatXpProgress } from "./xpRankRules";

describe("XP rank progress", () => {
  it("uses the same square-based thresholds as levelForXp", () => {
    expect(formatXpProgress(350, 1)).toMatchObject({ currentFloor: 100, nextFloor: 400, percent: 83 });
  });
  it("clamps malformed values to a safe empty level-zero bar", () => expect(formatXpProgress(-5, -1)).toMatchObject({ currentFloor: 0, nextFloor: 100, percent: 0 }));
});
