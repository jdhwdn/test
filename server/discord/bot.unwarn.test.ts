import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({ getCommandRoleIds: vi.fn(), resolveWarningRecord: vi.fn() }));
const logMocks = vi.hoisted(() => ({ logDiscordEvent: vi.fn() }));

vi.mock("../db", async importOriginal => ({
  ...(await importOriginal<typeof import("../db")>()),
  getCommandRoleIds: dbMocks.getCommandRoleIds,
  resolveWarningRecord: dbMocks.resolveWarningRecord,
}));
vi.mock("./logging", () => ({ logDiscordEvent: logMocks.logDiscordEvent }));

import { handleCommunityCommand } from "./bot";

function makeInteraction(allowed = true) {
  const moderator = { roles: { cache: new Map() }, permissions: { has: () => allowed } };
  return {
    guild: { id: "guild-warning", members: { fetch: vi.fn().mockResolvedValue(moderator) } },
    channel: { isTextBased: () => true },
    commandName: "unwarn",
    user: { id: "moderator-1", username: "Moderator" },
    options: { getUser: () => ({ id: "member-1", username: "Member" }), getInteger: () => 17 },
    reply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe("/unwarn handler", () => {
  beforeEach(() => { vi.clearAllMocks(); dbMocks.getCommandRoleIds.mockResolvedValue([]); });

  it("resolves only the selected member warning in the current guild and emits a redacted audit event", async () => {
    dbMocks.resolveWarningRecord.mockResolvedValue(true);
    const interaction = makeInteraction();
    await handleCommunityCommand(interaction);
    expect(dbMocks.resolveWarningRecord).toHaveBeenCalledWith({ guildId: "guild-warning", memberId: "member-1", id: 17 });
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true, allowedMentions: { users: ["member-1"] } }));
    expect(logMocks.logDiscordEvent).toHaveBeenCalledWith(expect.objectContaining({ eventKey: "warning.resolved", details: { "Warning ID": "17", "Reason": "Not repeated in log" } }));
  });

  it("refuses unknown, inactive, or cross-guild warning IDs without emitting an audit event", async () => {
    dbMocks.resolveWarningRecord.mockResolvedValue(false);
    const interaction = makeInteraction();
    await handleCommunityCommand(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true, content: expect.stringContaining("لم أجد تحذيراً نشطاً") }));
    expect(logMocks.logDiscordEvent).not.toHaveBeenCalled();
  });

  it("checks moderator permission before querying the warning record", async () => {
    const interaction = makeInteraction(false);
    await handleCommunityCommand(interaction);
    expect(dbMocks.resolveWarningRecord).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true, content: expect.stringContaining("صلاحية") }));
  });
});
