import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({ adjustMemberXp: vi.fn(), getCommandRoleIds: vi.fn() }));
const logMocks = vi.hoisted(() => ({ logDiscordEvent: vi.fn() }));

vi.mock("../db", async importOriginal => ({
  ...(await importOriginal<typeof import("../db")>()),
  adjustMemberXp: dbMocks.adjustMemberXp,
  getCommandRoleIds: dbMocks.getCommandRoleIds,
}));
vi.mock("./logging", () => ({ logDiscordEvent: logMocks.logDiscordEvent }));

import { handleModerationCommand } from "./bot";

function makeInteraction(amount: number) {
  const target = { id: "member-1", username: "Member" };
  const targetMember = { id: target.id, displayName: "Target Member", toString: () => `<@${target.id}>` };
  const executorMember = { roles: { cache: new Map() }, permissions: { has: () => true } };
  return {
    guild: { id: "guild-xp", members: { fetch: vi.fn().mockImplementation((id: string) => Promise.resolve(id === target.id ? targetMember : executorMember)) } },
    member: {},
    commandName: "xp",
    user: { id: "admin-1", username: "Admin" },
    options: { getUser: () => target, getString: () => "admin update", getInteger: () => amount },
    reply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe("/xp moderation handler", () => {
  beforeEach(() => { vi.clearAllMocks(); dbMocks.getCommandRoleIds.mockResolvedValue([]); dbMocks.adjustMemberXp.mockResolvedValue({ xp: 1_000_000, level: 100 }); });

  it("clamps a malformed excessive XP adjustment before persistence and audit logging", async () => {
    const interaction = makeInteraction(9_999_999);
    await handleModerationCommand(interaction);
    expect(dbMocks.adjustMemberXp).toHaveBeenCalledWith(expect.objectContaining({ guildId: "guild-xp", memberId: "member-1", delta: 1_000_000 }));
    expect(logMocks.logDiscordEvent).toHaveBeenCalledWith(expect.objectContaining({ eventKey: "xp.adjusted", details: expect.objectContaining({ Change: "+1000000 XP" }) }));
  });

  it("refuses a zero XP change before persistence", async () => {
    const interaction = makeInteraction(0);
    await expect(handleModerationCommand(interaction)).rejects.toThrow("يجب ألا يكون صفراً");
    expect(dbMocks.adjustMemberXp).not.toHaveBeenCalled();
  });
});
