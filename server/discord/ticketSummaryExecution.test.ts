import { describe, expect, it, vi } from "vitest";
import { executeTicketMetadataSummary, type TicketSummaryRecord } from "./ticketSummaryExecution";

const matchingTicket: TicketSummaryRecord = { id: 12, guildId: "guild-a", openerLabel: "عضو", status: "claimed", createdAt: new Date("2026-08-25T00:00:00.000Z"), closedAt: null, staffSummaryMetadata: "الحالة: قيد المتابعة", claimedById: null, closedById: null };

describe("ticket summary execution", () => {
  it("persists only explicit staff metadata scoped to the current ticket guild", async () => {
    const saveMetadata = vi.fn().mockResolvedValue(undefined);
    const getTicket = vi.fn().mockResolvedValue(matchingTicket);
    const result = await executeTicketMetadataSummary({ ticketId: 12, guildId: "guild-a", suppliedMetadata: "الإجراء: تم التصعيد", getTicket, saveMetadata });
    expect(result).toMatchObject({ allowed: true, persisted: true, ticket: { staffSummaryMetadata: "الإجراء: تم التصعيد" } });
    expect(getTicket).toHaveBeenCalledWith({ guildId: "guild-a", id: 12 });
    expect(saveMetadata).toHaveBeenCalledWith({ guildId: "guild-a", id: 12, metadata: "الإجراء: تم التصعيد" });
  });

  it("reuses matching-guild metadata without saving and blocks cross-guild persistence", async () => {
    const saveMetadata = vi.fn().mockResolvedValue(undefined);
    const reuse = await executeTicketMetadataSummary({ ticketId: 12, guildId: "guild-a", getTicket: vi.fn().mockResolvedValue(matchingTicket), saveMetadata });
    expect(reuse).toMatchObject({ allowed: true, persisted: false, ticket: { staffSummaryMetadata: "الحالة: قيد المتابعة" } });
    expect(saveMetadata).not.toHaveBeenCalled();
    const crossGuildGet = vi.fn().mockResolvedValue(undefined);
    const crossGuild = await executeTicketMetadataSummary({ ticketId: 12, guildId: "guild-b", suppliedMetadata: "لا يجب حفظه", getTicket: crossGuildGet, saveMetadata });
    expect(crossGuild).toEqual({ allowed: false, reason: "not_found" });
    expect(crossGuildGet).toHaveBeenCalledWith({ guildId: "guild-b", id: 12 });
    expect(saveMetadata).not.toHaveBeenCalled();
  });
});
