import { afterEach, describe, expect, it } from "vitest";
import { getSupportTicketByGuildId, saveSupportTicketSummaryMetadata, setDbForTests } from "./db";

function conditionContainsGuildId(value: unknown, seen = new Set<unknown>()): boolean {
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  if ((value as { name?: unknown }).name === "guildId") return true;
  return Object.values(value as Record<string, unknown>).some(item => conditionContainsGuildId(item, seen));
}

describe("ticket summary metadata database scope", () => {
  afterEach(() => setDbForTests(null));
  it("adds guildId to both ticket retrieval and metadata-save predicates", async () => {
    const predicates: unknown[] = [];
    const fakeDb = {
      select: () => ({ from: () => ({ where: (predicate: unknown) => { predicates.push(predicate); return { limit: async () => [] }; } }) }),
      update: () => ({ set: () => ({ where: async (predicate: unknown) => { predicates.push(predicate); } }) }),
    };
    setDbForTests(fakeDb as never);
    await getSupportTicketByGuildId({ guildId: "guild-a", id: 7 });
    await saveSupportTicketSummaryMetadata({ guildId: "guild-a", id: 7, metadata: "ملاحظة وصفية" });
    expect(predicates).toHaveLength(2);
    expect(predicates.every(predicate => conditionContainsGuildId(predicate))).toBe(true);
  });
});
