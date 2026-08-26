import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({ getMemberXpProfile: vi.fn() }));
vi.mock("../db", async importOriginal => ({ ...(await importOriginal<typeof import("../db")>()), getMemberXpProfile: dbMocks.getMemberXpProfile }));

import { handleCommunityCommand } from "./bot";

describe("/rank handler", () => {
  beforeEach(() => { vi.clearAllMocks(); dbMocks.getMemberXpProfile.mockResolvedValue({ xp: 350, level: 1 }); });
  it("reads the requesting member's profile only inside the current guild without mentions", async () => {
    const interaction = { guild: { id: "guild-rank" }, channel: { isTextBased: () => true }, commandName: "rank", user: { id: "member-rank", username: "Member" }, options: {}, reply: vi.fn().mockResolvedValue(undefined) } as any;
    await handleCommunityCommand(interaction);
    expect(dbMocks.getMemberXpProfile).toHaveBeenCalledWith("guild-rank", "member-rank");
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array), allowedMentions: { parse: [] } }));
  });
});
