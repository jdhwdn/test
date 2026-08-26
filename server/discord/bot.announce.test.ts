import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChannelType } from "discord.js";

const dbMocks = vi.hoisted(() => ({ getCommandRoleIds: vi.fn() }));
const logMocks = vi.hoisted(() => ({ logDiscordEvent: vi.fn() }));

vi.mock("../db", async importOriginal => ({ ...(await importOriginal<typeof import("../db")>()), getCommandRoleIds: dbMocks.getCommandRoleIds }));
vi.mock("./logging", () => ({ logDiscordEvent: logMocks.logDiscordEvent }));

import { handleCommunityCommand } from "./bot";

function makeInteraction(input?: { allowed?: boolean; roleMentionable?: boolean }) {
  const destination = { id: "channel-a", name: "announcements", type: ChannelType.GuildText, permissionsFor: vi.fn().mockReturnValue({ has: () => true }), send: vi.fn().mockResolvedValue(undefined), toString: () => "<#channel-a>" };
  const moderator = { roles: { cache: new Map() }, permissions: { has: () => input?.allowed ?? true } };
  const role = { id: "role-a", mentionable: input?.roleMentionable ?? true };
  return {
    destination,
    interaction: {
      guild: { id: "guild-a", members: { me: { id: "bot-a" }, fetch: vi.fn().mockResolvedValue(moderator) } }, channel: { isTextBased: () => true }, commandName: "announce", user: { id: "moderator-a", username: "Moderator" },
      options: { getChannel: () => destination, getRole: () => role, getString: (name: string) => name === "title" ? "خبر المجتمع" : "تفاصيل الإعلان" }, reply: vi.fn().mockResolvedValue(undefined),
    } as any,
  };
}

describe("/announce handler", () => {
  beforeEach(() => { vi.clearAllMocks(); dbMocks.getCommandRoleIds.mockResolvedValue([]); });
  it("sends a scoped announcement embed with an explicitly allowed role mention", async () => {
    const { interaction, destination } = makeInteraction();
    await handleCommunityCommand(interaction);
    expect(destination.send).toHaveBeenCalledWith(expect.objectContaining({ content: "<@&role-a>", allowedMentions: { roles: ["role-a"], parse: [] } }));
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true, content: expect.stringContaining("تم نشر") }));
    expect(logMocks.logDiscordEvent).toHaveBeenCalledWith(expect.objectContaining({ eventKey: "announcement.sent", details: expect.objectContaining({ "Message": "Not retained in audit log body" }) }));
  });
  it("does not send when the requested role cannot be mentioned", async () => {
    const { interaction, destination } = makeInteraction({ roleMentionable: false });
    destination.permissionsFor.mockReturnValue({ has: (permission: bigint) => permission !== BigInt(1 << 17) });
    await handleCommunityCommand(interaction);
    expect(destination.send).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true, content: expect.stringContaining("غير قابلة للذكر") }));
  });
});
