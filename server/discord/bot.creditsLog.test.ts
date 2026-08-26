import { beforeEach, describe, expect, it, vi } from "vitest";
const dbMocks = vi.hoisted(() => ({ listEconomyTransactionHistory: vi.fn() }));
vi.mock("../db", async original => ({ ...(await original<typeof import("../db")>()), listEconomyTransactionHistory: dbMocks.listEconomyTransactionHistory }));
import { handleCommunityCommand } from "./bot";
describe("/creditslog handler", () => {
  beforeEach(() => vi.clearAllMocks());
  it("reads only the invoking member history in the current guild and replies privately", async () => {
    dbMocks.listEconomyTransactionHistory.mockResolvedValue([{ amount: 50, kind: "reward", createdAt: new Date("2026-08-26T00:00:00.000Z") }]);
    const interaction = { guild: { id: "guild-economy" }, channel: { isTextBased: () => true }, commandName: "creditslog", user: { id: "member-1", username: "Member" }, options: { getInteger: () => 99 }, reply: vi.fn().mockResolvedValue(undefined) } as any;
    await handleCommunityCommand(interaction);
    expect(dbMocks.listEconomyTransactionHistory).toHaveBeenCalledWith({ guildId: "guild-economy", memberId: "member-1", limit: 15 });
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true, allowedMentions: { parse: [] } }));
  });
});
