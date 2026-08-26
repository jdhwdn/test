import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({ getCommunityEventById: vi.fn(), closeCommunityEvent: vi.fn(), getEventRsvpSummary: vi.fn() }));
const logMocks = vi.hoisted(() => ({ logDiscordEvent: vi.fn() }));
vi.mock("../db", async importOriginal => ({ ...(await importOriginal<typeof import("../db")>()), getCommunityEventById: dbMocks.getCommunityEventById, closeCommunityEvent: dbMocks.closeCommunityEvent, getEventRsvpSummary: dbMocks.getEventRsvpSummary }));
vi.mock("./logging", () => ({ logDiscordEvent: logMocks.logDiscordEvent }));

import { handleCommunityCommand } from "./bot";

function makeInteraction(guildId = "guild-a") {
  return { guild: { id: guildId }, channel: { isTextBased: () => true }, commandName: "eventend", user: { id: "manager-a", username: "Manager" }, memberPermissions: { has: () => true }, options: { getInteger: () => 12 }, reply: vi.fn().mockResolvedValue(undefined) } as any;
}

describe("/eventend handler", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("completes a same-guild scheduled event and sends only aggregate RSVP data", async () => {
    dbMocks.getCommunityEventById.mockResolvedValue({ id: 12, guildId: "guild-a", status: "scheduled", title: "فعالية" });
    dbMocks.closeCommunityEvent.mockResolvedValue(true);
    dbMocks.getEventRsvpSummary.mockResolvedValue([{ state: "going", total: 3 }, { state: "maybe", total: 1 }, { state: "declined", total: 2 }]);
    const interaction = makeInteraction();
    await handleCommunityCommand(interaction);
    expect(dbMocks.closeCommunityEvent).toHaveBeenCalledWith({ guildId: "guild-a", id: 12 });
    expect(dbMocks.getEventRsvpSummary).toHaveBeenCalledWith(12);
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array) }));
    expect(logMocks.logDiscordEvent).toHaveBeenCalledWith(expect.objectContaining({ eventKey: "event.completed", details: expect.objectContaining({ "Member identities": "Not retained" }) }));
  });
  it("refuses an event belonging to a different guild before persistence", async () => {
    dbMocks.getCommunityEventById.mockResolvedValue({ id: 12, guildId: "guild-b", status: "scheduled", title: "خارج النطاق" });
    const interaction = makeInteraction("guild-a");
    await handleCommunityCommand(interaction);
    expect(dbMocks.closeCommunityEvent).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true, content: expect.stringContaining("غير متاحة") }));
  });
});
