import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({ listModerationCasesSince: vi.fn() }));

vi.mock("../db", async importOriginal => ({
  ...(await importOriginal<typeof import("../db")>()),
  listModerationCasesSince: dbMocks.listModerationCasesSince,
}));

import { handleCommunityCommand } from "./bot";

function makeInteraction(permitted = true, hours = 24) {
  return {
    guild: { id: "guild-report" },
    channel: { isTextBased: () => true },
    commandName: "modreport",
    user: { id: "admin-1", username: "Admin" },
    memberPermissions: { has: vi.fn().mockReturnValue(permitted) },
    options: { getInteger: () => hours },
    reply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe("/modreport handler", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("reads only current-guild cases and returns private aggregate rows without case reasons", async () => {
    dbMocks.listModerationCasesSince.mockResolvedValue([
      { executorId: "mod-a", executorLabel: "Mod A", action: "warn", reason: "private reason one" },
      { executorId: "mod-a", executorLabel: "Mod A", action: "mute", reason: "private reason two" },
      { executorId: "mod-b", executorLabel: "Mod B", action: "kick", reason: "private reason three" },
    ]);
    const interaction = makeInteraction();
    await handleCommunityCommand(interaction);
    expect(dbMocks.listModerationCasesSince).toHaveBeenCalledWith("guild-report", expect.any(Date));
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true, allowedMentions: { users: ["mod-a", "mod-b"] } }));
    expect(JSON.stringify(interaction.reply.mock.calls)).not.toContain("private reason");
  });

  it("refuses a member without server-management permission before querying records", async () => {
    const interaction = makeInteraction(false);
    await handleCommunityCommand(interaction);
    expect(dbMocks.listModerationCasesSince).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true, content: expect.stringContaining("إدارة السيرفر") }));
  });

  it("defensively clamps a malformed report-period value to the published 1–168 hour range", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-26T00:00:00.000Z"));
    dbMocks.listModerationCasesSince.mockResolvedValue([]);
    const interaction = makeInteraction(true, 9999);
    await handleCommunityCommand(interaction);
    expect(dbMocks.listModerationCasesSince).toHaveBeenCalledWith("guild-report", new Date("2026-08-19T00:00:00.000Z"));
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array) }));
    vi.useRealTimers();
  });
});
