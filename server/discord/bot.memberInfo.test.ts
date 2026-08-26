import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({ getMemberLevel: vi.fn(), getEconomyProfile: vi.fn() }));

vi.mock("../db", async importOriginal => ({
  ...(await importOriginal<typeof import("../db")>()),
  getMemberLevel: dbMocks.getMemberLevel,
  getEconomyProfile: dbMocks.getEconomyProfile,
}));

import { handleCommunityCommand } from "./bot";

describe("/memberinfo handler", () => {
  beforeEach(() => { vi.clearAllMocks(); dbMocks.getMemberLevel.mockResolvedValue(7); dbMocks.getEconomyProfile.mockResolvedValue({ balance: 250, reputation: 4 }); });
  it("loads profile metrics only under the current guild and returns a no-mention embed", async () => {
    const target = { id: "member-a", username: "Member", createdTimestamp: Date.UTC(2025, 0, 1), displayAvatarURL: () => "https://cdn.example/avatar.png" };
    const member = { id: "member-a", displayName: "عضو", displayColor: 0x5865F2, displayHexColor: "#5865F2", joinedTimestamp: Date.UTC(2025, 1, 1), roles: { cache: new Map([["guild-a", {}], ["role-a", {}]]) } };
    const interaction = { guild: { id: "guild-a", members: { fetch: vi.fn().mockResolvedValue(member) } }, channel: { isTextBased: () => true }, commandName: "memberinfo", user: target, options: { getUser: () => target }, reply: vi.fn().mockResolvedValue(undefined) } as any;
    await handleCommunityCommand(interaction);
    expect(dbMocks.getMemberLevel).toHaveBeenCalledWith("guild-a", "member-a");
    expect(dbMocks.getEconomyProfile).toHaveBeenCalledWith("guild-a", "member-a");
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array), allowedMentions: { parse: [] } }));
  });
});
