import { describe, expect, it } from "vitest";
import { formatXpLeaderboard } from "./xpLeaderboard";

describe("XP leaderboard formatting", () => {
  it("renders the highest ten entries with safe labels", () => {
    const rows = Array.from({ length: 11 }, (_, index) => ({ memberLabel: index === 0 ? "**Admin**\n" : `Member ${index + 1}`, level: 11 - index, xp: (11 - index) * 100 }));
    const text = formatXpLeaderboard(rows);
    expect(text).toContain("**1.** Admin");
    expect(text).toContain("1,100 XP");
    expect(text).not.toContain("Member 11");
  });
  it("uses a clear empty state", () => expect(formatXpLeaderboard([])).toContain("لا توجد نقاط XP"));
});
