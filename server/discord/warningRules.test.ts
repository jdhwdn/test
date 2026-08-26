import { describe, expect, it } from "vitest";
import { resolveWarningExpiry } from "./warningRules";

describe("warning expiry policy", () => {
  it("sets warning expiry using the configured safe day count", () => {
    const start = new Date("2026-08-25T00:00:00.000Z");
    expect(resolveWarningExpiry(start, 14).toISOString()).toBe("2026-09-08T00:00:00.000Z");
  });

  it("falls back to 30 days when a policy value is outside safe bounds", () => {
    const start = new Date("2026-08-25T00:00:00.000Z");
    expect(resolveWarningExpiry(start, 0).toISOString()).toBe("2026-09-24T00:00:00.000Z");
    expect(resolveWarningExpiry(start, 366).toISOString()).toBe("2026-09-24T00:00:00.000Z");
  });
});
