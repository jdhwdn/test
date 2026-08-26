import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({ listXpLeaderboard: vi.fn() }));

vi.mock("../db", async importOriginal => ({
  ...(await importOriginal<typeof import("../db")>()),
  listXpLeaderboard: dbMocks.listXpLeaderboard,
}));

import { handleCommunityCommand } from "./bot";

describe("/xptop handler", () => {
  beforeEach(() => vi.clearAllMocks());
  it("reads only the current guild leaderboard and sends a public embed", async () => {
    dbMocks.listXpLeaderboard.mockResolvedValue([{ memberLabel: "مشارك", xp: 900, level: 3 }]);
    const interaction = {
      guild: { id: "guild-xp" }, channel: { isTextBased: () => true }, commandName: "xptop", user: { id: "member-1", username: "Member" }, options: {}, reply: vi.fn().mockResolvedValue(undefined),
    } as any;
    await handleCommunityCommand(interaction);
    expect(dbMocks.listXpLeaderboard).toHaveBeenCalledWith("guild-xp");
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array), allowedMentions: { parse: [] } }));
  });
});
