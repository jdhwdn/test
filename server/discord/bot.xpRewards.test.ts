import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({ listLevelRoleRewards: vi.fn() }));
vi.mock("../db", async importOriginal => ({ ...(await importOriginal<typeof import("../db")>()), listLevelRoleRewards: dbMocks.listLevelRoleRewards }));

import { handleCommunityCommand } from "./bot";

describe("/xprewards handler", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("loads only the current guild rewards, sorts levels, and disables role mentions", async () => {
    dbMocks.listLevelRoleRewards.mockResolvedValue([{ id: 2, level: 10, roleId: "role-ten" }, { id: 1, level: 3, roleId: "role-three" }]);
    const interaction = { guild: { id: "guild-xp" }, channel: { isTextBased: () => true }, commandName: "xprewards", user: { id: "member-1", username: "Member" }, options: {}, reply: vi.fn().mockResolvedValue(undefined) } as any;
    await handleCommunityCommand(interaction);
    expect(dbMocks.listLevelRoleRewards).toHaveBeenCalledWith("guild-xp");
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array), allowedMentions: { parse: [] } }));
    const embed = interaction.reply.mock.calls[0][0].embeds[0].data;
    expect(embed.description.indexOf("role-three")).toBeLessThan(embed.description.indexOf("role-ten"));
  });
});
