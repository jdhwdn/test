import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({ getCommandRoleIds: vi.fn(), listActiveWarnings: vi.fn() }));

vi.mock("../db", async importOriginal => ({
  ...(await importOriginal<typeof import("../db")>()),
  getCommandRoleIds: dbMocks.getCommandRoleIds,
  listActiveWarnings: dbMocks.listActiveWarnings,
}));

import { handleCommunityCommand } from "./bot";

function makeInteraction(allowed = true) {
  const moderator = { roles: { cache: new Map() }, permissions: { has: () => allowed } };
  return {
    guild: { id: "guild-warning", members: { fetch: vi.fn().mockResolvedValue(moderator) } }, channel: { isTextBased: () => true }, commandName: "warnings", user: { id: "moderator-1", username: "Moderator" },
    options: { getUser: () => ({ id: "member-1", username: "Member" }) }, reply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe("/warnings handler", () => {
  beforeEach(() => { vi.clearAllMocks(); dbMocks.getCommandRoleIds.mockResolvedValue([]); });
  it("reads active warnings only within the interaction guild and replies ephemerally", async () => {
    dbMocks.listActiveWarnings.mockResolvedValue([{ id: 1, moderatorLabel: "Moderator", reason: "Spam", createdAt: new Date(), expiresAt: new Date("2026-09-01T00:00:00.000Z") }]);
    const interaction = makeInteraction();
    await handleCommunityCommand(interaction);
    expect(dbMocks.listActiveWarnings).toHaveBeenCalledWith({ guildId: "guild-warning", memberId: "member-1" });
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true, allowedMentions: { parse: [] } }));
  });
  it("refuses a moderator without the configured role or fallback permission", async () => {
    const interaction = makeInteraction(false);
    await handleCommunityCommand(interaction);
    expect(dbMocks.listActiveWarnings).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true, content: expect.stringContaining("صلاحية") }));
  });
});
