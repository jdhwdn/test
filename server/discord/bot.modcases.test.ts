import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({ listModerationCaseHistory: vi.fn() }));
vi.mock("../db", async original => ({ ...(await original<typeof import("../db")>()), listModerationCaseHistory: dbMocks.listModerationCaseHistory }));
import { handleCommunityCommand } from "./bot";

function makeInteraction(allowed = true, limit = 10) {
  return { guild: { id: "guild-cases" }, channel: { isTextBased: () => true }, commandName: "modcases", user: { id: "admin-1", username: "Admin" }, memberPermissions: { has: () => allowed }, options: { getInteger: () => limit }, reply: vi.fn().mockResolvedValue(undefined) } as any;
}

describe("/modcases handler", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("reads bounded current-guild case history and keeps the response private without mentions", async () => {
    dbMocks.listModerationCaseHistory.mockResolvedValue([{ action: "warn", executorLabel: "Admin", memberLabel: "Member", createdAt: new Date("2026-08-26T00:00:00.000Z") }]);
    const interaction = makeInteraction(true, 999);
    await handleCommunityCommand(interaction);
    expect(dbMocks.listModerationCaseHistory).toHaveBeenCalledWith({ guildId: "guild-cases", limit: 20 });
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true, allowedMentions: { parse: [] } }));
  });
  it("rejects callers without Manage Server before reading cases", async () => {
    const interaction = makeInteraction(false);
    await handleCommunityCommand(interaction);
    expect(dbMocks.listModerationCaseHistory).not.toHaveBeenCalled();
  });
});
