import { describe, expect, it, vi } from "vitest";
import { ChannelType, PermissionFlagsBits } from "discord.js";
import { isEligibleGuildVoiceChannel } from "./bot";

function candidate(type: ChannelType, granted: bigint[]) {
  return {
    type,
    permissionsFor: vi.fn().mockReturnValue({
      has: (requested: bigint[]) => requested.every(permission => granted.includes(permission)),
    }),
  };
}

describe("dedicated voice conversation channel eligibility", () => {
  const botMember = { id: "bot-1" };
  const voicePermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak];

  it("accepts only a voice channel where the bot can view, connect, and speak", () => {
    expect(isEligibleGuildVoiceChannel(candidate(ChannelType.GuildVoice, voicePermissions) as never, botMember as never)).toBe(true);
  });

  it("rejects text channels and voice rooms missing a required permission", () => {
    expect(isEligibleGuildVoiceChannel(candidate(ChannelType.GuildText, voicePermissions) as never, botMember as never)).toBe(false);
    expect(isEligibleGuildVoiceChannel(candidate(ChannelType.GuildVoice, voicePermissions.slice(0, 2)) as never, botMember as never)).toBe(false);
  });
});
