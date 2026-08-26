import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({ getSupportTicketByGuildId: vi.fn(), saveSupportTicketSummaryMetadata: vi.fn() }));
const logMocks = vi.hoisted(() => ({ logDiscordEvent: vi.fn() }));

vi.mock("../db", async importOriginal => ({
  ...(await importOriginal<typeof import("../db")>()),
  getSupportTicketByGuildId: dbMocks.getSupportTicketByGuildId,
  saveSupportTicketSummaryMetadata: dbMocks.saveSupportTicketSummaryMetadata,
}));
vi.mock("./logging", () => ({ logDiscordEvent: logMocks.logDiscordEvent }));

import { handleCommunityCommand } from "./bot";

const ticket = {
  id: 41, guildId: "guild-a", panelId: 1, channelId: "channel-a", openerId: "member-a", openerLabel: "عضو", status: "claimed" as const,
  claimedById: "staff-a", staffSummaryMetadata: "الحالة: قيد المتابعة", closedById: null, closedAt: null, createdAt: new Date("2026-08-25T00:00:00.000Z"),
};

function makeInteraction(input: { guildId?: string; metadata?: string | null }) {
  return {
    guild: { id: input.guildId ?? "guild-a" },
    channel: { isTextBased: () => true },
    commandName: "ticketsummary",
    memberPermissions: { has: () => true },
    user: { id: "moderator-a", username: "Moderator" },
    options: { getInteger: () => 41, getString: () => input.metadata ?? null },
    reply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe("/ticketsummary handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.saveSupportTicketSummaryMetadata.mockResolvedValue(undefined);
  });

  it("stores staff-supplied metadata only through the current guild-scoped database path", async () => {
    dbMocks.getSupportTicketByGuildId.mockResolvedValue(ticket);
    const interaction = makeInteraction({ metadata: "الإجراء: تم التصعيد" });
    await handleCommunityCommand(interaction);
    expect(dbMocks.getSupportTicketByGuildId).toHaveBeenCalledWith({ guildId: "guild-a", id: 41 });
    expect(dbMocks.saveSupportTicketSummaryMetadata).toHaveBeenCalledWith({ guildId: "guild-a", id: 41, metadata: "الإجراء: تم التصعيد" });
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining("الإجراء: تم التصعيد") }));
  });

  it("reuses stored metadata without persisting and rejects a ticket absent from another guild", async () => {
    dbMocks.getSupportTicketByGuildId.mockResolvedValueOnce(ticket).mockResolvedValueOnce(undefined);
    const reuse = makeInteraction({});
    await handleCommunityCommand(reuse);
    expect(dbMocks.saveSupportTicketSummaryMetadata).not.toHaveBeenCalled();
    expect(reuse.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining("الحالة: قيد المتابعة") }));
    const crossGuild = makeInteraction({ guildId: "guild-b", metadata: "لا يجب حفظه" });
    await handleCommunityCommand(crossGuild);
    expect(dbMocks.getSupportTicketByGuildId).toHaveBeenLastCalledWith({ guildId: "guild-b", id: 41 });
    expect(dbMocks.saveSupportTicketSummaryMetadata).not.toHaveBeenCalled();
  });
});
