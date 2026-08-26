import { describe, expect, it } from "vitest";
import { planTicketMetadataSummary } from "./ticketSummaryRules";

describe("ticket metadata summary flow", () => {
  const ticket = { id: 7, guildId: "guild-a", staffSummaryMetadata: "حالة الطلب: قيد المتابعة" };
  it("uses stored staff metadata only when the ticket belongs to the current guild", () => {
    expect(planTicketMetadataSummary({ ticket, requestedGuildId: "guild-a" })).toEqual({ allowed: true, ticketId: 7, metadata: "حالة الطلب: قيد المتابعة", shouldPersist: false });
  });
  it("persists only explicit staff metadata and rejects another guild", () => {
    expect(planTicketMetadataSummary({ ticket, requestedGuildId: "guild-a", suppliedMetadata: "الإجراء: أُحيل للفريق" })).toMatchObject({ allowed: true, metadata: "الإجراء: أُحيل للفريق", shouldPersist: true });
    expect(planTicketMetadataSummary({ ticket, requestedGuildId: "guild-b", suppliedMetadata: "نص لا يجب حفظه" })).toEqual({ allowed: false, reason: "guild_scope_mismatch" });
  });
});
