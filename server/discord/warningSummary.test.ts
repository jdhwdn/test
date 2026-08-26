import { describe, expect, it } from "vitest";
import { formatActiveWarnings } from "./warningSummary";

describe("active warning summary", () => {
  it("formats only bounded sanitized internal warning details", () => {
    const output = formatActiveWarnings([{ id: 1, moderatorLabel: "<@123> Mod", reason: "**Spam**\n<@456>", createdAt: new Date(), expiresAt: new Date("2026-09-01T00:00:00.000Z") }]);
    expect(output).toContain("Spam");
    expect(output).toContain("[mention]");
    expect(output).toContain("<t:1788220800:R>");
  });
  it("uses an explicit empty state", () => expect(formatActiveWarnings([])).toContain("لا توجد تحذيرات نشطة"));
});
