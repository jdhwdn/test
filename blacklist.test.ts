import { describe, expect, it } from "vitest";
import { isValidDiscordUserId, requireDatabase, resolveBlacklistAddOutcome } from "./db";

describe("Discord blacklist ID validation", () => {
  it("accepts copied Discord user IDs only", () => {
    expect(isValidDiscordUserId("12345678901234567")).toBe(true);
    expect(isValidDiscordUserId("12345678901234567890")).toBe(true);
    expect(isValidDiscordUserId(" 12345678901234567 ")).toBe(true);
  });

  it("rejects names, short values, and malformed values", () => {
    expect(isValidDiscordUserId("Majlsawi")).toBe(false);
    expect(isValidDiscordUserId("12345")).toBe(false);
    expect(isValidDiscordUserId("12345678901234567abc")).toBe(false);
  });

  it("reports a missing database explicitly instead of treating the member as already blacklisted", () => {
    expect(() => requireDatabase(null, "إضافة عضو للبلاك ليست")).toThrow("DATABASE_URL");
    expect(requireDatabase({ connected: true }, "اختبار الاتصال")).toEqual({ connected: true });
  });

  it("distinguishes a confirmed duplicate from a new blacklist entry", () => {
    expect(resolveBlacklistAddOutcome(false)).toBe("added");
    expect(resolveBlacklistAddOutcome(true)).toBe("already_exists");
    expect(resolveBlacklistAddOutcome(false, false)).toBe("unavailable_database");
  });

  it("returns an explicit unavailable result from the real add path without DATABASE_URL", async () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const { addBlacklistedMember } = await import("./db");
      await expect(addBlacklistedMember({ guildId: "guild-1", memberId: "12345678901234567", addedById: "admin-1" }))
        .resolves.toMatchObject({ outcome: "unavailable_database" });
    } finally {
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });
});
