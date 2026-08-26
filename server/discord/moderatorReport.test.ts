import { describe, expect, it } from "vitest";
import { buildModeratorActivityRows } from "./moderatorReport";

describe("moderator activity report", () => {
  it("aggregates counts only without reasons or message content", () => {
    expect(buildModeratorActivityRows([{ executorId: "a", executorLabel: "Admin", action: "warn" }, { executorId: "a", executorLabel: "Admin", action: "warn" }, { executorId: "b", executorLabel: "Mod", action: "mute" }])).toEqual([{ id: "a", label: "Admin", total: 2, actions: [["warn", 2]] }, { id: "b", label: "Mod", total: 1, actions: [["mute", 1]] }]);
  });
});
