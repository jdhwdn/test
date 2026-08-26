import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({ getPollById: vi.fn(), closePoll: vi.fn(), listPollResults: vi.fn() }));
const logMocks = vi.hoisted(() => ({ logDiscordEvent: vi.fn() }));
vi.mock("../db", async importOriginal => ({ ...(await importOriginal<typeof import("../db")>()), getPollById: dbMocks.getPollById, closePoll: dbMocks.closePoll, listPollResults: dbMocks.listPollResults }));
vi.mock("./logging", () => ({ logDiscordEvent: logMocks.logDiscordEvent }));

import { handleCommunityCommand } from "./bot";

function makeInteraction(guildId = "guild-a") {
  return { guild: { id: guildId }, channel: { isTextBased: () => true }, commandName: "pollend", user: { id: "manager-a", username: "Manager" }, memberPermissions: { has: () => true }, options: { getInteger: () => 8 }, reply: vi.fn().mockResolvedValue(undefined) } as any;
}

describe("/pollend handler", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("closes an active same-guild poll and publishes aggregate results", async () => {
    dbMocks.getPollById.mockResolvedValue({ id: 8, guildId: "guild-a", status: "active", question: "السؤال" });
    dbMocks.closePoll.mockResolvedValue(true);
    dbMocks.listPollResults.mockResolvedValue([{ label: "نعم", position: 0, votes: 2 }, { label: "لا", position: 1, votes: 1 }]);
    const interaction = makeInteraction();
    await handleCommunityCommand(interaction);
    expect(dbMocks.closePoll).toHaveBeenCalledWith({ guildId: "guild-a", id: 8 });
    expect(dbMocks.listPollResults).toHaveBeenCalledWith(8);
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array) }));
    expect(logMocks.logDiscordEvent).toHaveBeenCalledWith(expect.objectContaining({ eventKey: "poll.closed", details: expect.objectContaining({ "Voter identities": "Not retained" }) }));
  });
  it("does not close a poll that belongs to another guild", async () => {
    dbMocks.getPollById.mockResolvedValue({ id: 8, guildId: "guild-b", status: "active", question: "خارج النطاق" });
    const interaction = makeInteraction("guild-a");
    await handleCommunityCommand(interaction);
    expect(dbMocks.closePoll).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true, content: expect.stringContaining("غير متاح") }));
  });
});
