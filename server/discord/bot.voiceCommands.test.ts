import { beforeEach, describe, expect, it, vi } from "vitest";

const voiceMocks = vi.hoisted(() => ({
  getVoiceConnection: vi.fn(),
  joinVoiceChannel: vi.fn(),
  entersState: vi.fn(),
}));
const logMocks = vi.hoisted(() => ({ logDiscordEvent: vi.fn() }));
const conversationMocks = vi.hoisted(() => ({ startDirectedVoiceConversation: vi.fn(), stopDirectedVoiceConversation: vi.fn() }));
const dbMocks = vi.hoisted(() => ({ getCommandRoleIds: vi.fn(), getGuildSettings: vi.fn(), saveGuildSettings: vi.fn() }));

vi.mock("@discordjs/voice", async importOriginal => ({
  ...(await importOriginal<typeof import("@discordjs/voice")>()),
  ...voiceMocks,
}));
vi.mock("./logging", () => ({ logDiscordEvent: logMocks.logDiscordEvent }));
vi.mock("./voiceConversation", () => ({
  hasVoiceConversationConsent: vi.fn(),
  shouldStartDirectedVoiceConversation: (configuredChannelId: string | null | undefined, currentChannelId: string) => Boolean(configuredChannelId && configuredChannelId === currentChannelId),
  startDirectedVoiceConversation: conversationMocks.startDirectedVoiceConversation,
  stopDirectedVoiceConversation: conversationMocks.stopDirectedVoiceConversation,
}));
vi.mock("../db", async importOriginal => ({
  ...(await importOriginal<typeof import("../db")>()),
  getCommandRoleIds: dbMocks.getCommandRoleIds,
  getGuildSettings: dbMocks.getGuildSettings,
  saveGuildSettings: dbMocks.saveGuildSettings,
}));

import { PermissionFlagsBits } from "discord.js";
import { handleVoiceConnectionCommand } from "./bot";

function makeInteraction(input: {
  commandName: "join" | "leave";
  memberPermission?: boolean;
  voiceChannel?: { id: string; name: string; connect?: boolean; speak?: boolean } | null;
}) {
  const replies: unknown[] = [];
  const voiceChannel = input.voiceChannel ?? null;
  const requester = {
    displayName: "Voice Admin",
    voice: { channel: voiceChannel, channelId: voiceChannel?.id ?? null },
    roles: { cache: new Map() },
    permissions: { has: () => input.memberPermission ?? true },
  };
  const guild = {
    id: "guild-1",
    voiceAdapterCreator: {},
    members: {
      fetch: vi.fn().mockResolvedValue(requester),
      me: { id: "bot-1" },
      fetchMe: vi.fn().mockResolvedValue({ id: "bot-1" }),
    },
    channels: { cache: { get: vi.fn().mockReturnValue(voiceChannel) } },
  };
  if (voiceChannel) {
    Object.assign(voiceChannel, {
      permissionsFor: vi.fn().mockReturnValue({
        has: (permission: bigint) => permission === PermissionFlagsBits.Connect ? voiceChannel.connect !== false : voiceChannel.speak !== false,
      }),
    });
  }
  return {
    interaction: {
      guild,
      commandName: input.commandName,
      user: { id: "moderator-1" },
      reply: vi.fn().mockImplementation((payload: unknown) => { replies.push(payload); return Promise.resolve(); }),
    } as any,
    replies,
  };
}

describe("voice connection command handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getCommandRoleIds.mockResolvedValue([]);
    dbMocks.getGuildSettings.mockResolvedValue(undefined);
    dbMocks.saveGuildSettings.mockResolvedValue(undefined);
    voiceMocks.getVoiceConnection.mockReturnValue(null);
    voiceMocks.entersState.mockResolvedValue(undefined);
  });

  it("rejects /join when the requester is not in a voice room", async () => {
    const { interaction } = makeInteraction({ commandName: "join", voiceChannel: null });
    await handleVoiceConnectionCommand(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining("روم صوتي") }));
    expect(voiceMocks.joinVoiceChannel).not.toHaveBeenCalled();
  });

  it("rejects /join when the requester lacks the command permission", async () => {
    const { interaction } = makeInteraction({ commandName: "join", memberPermission: false, voiceChannel: { id: "voice-1", name: "General" } });
    await handleVoiceConnectionCommand(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining("configured role or permission") }));
    expect(voiceMocks.joinVoiceChannel).not.toHaveBeenCalled();
  });

  it("rejects /join when the bot lacks Connect or Speak", async () => {
    const { interaction } = makeInteraction({ commandName: "join", voiceChannel: { id: "voice-1", name: "General", connect: true, speak: false } });
    await handleVoiceConnectionCommand(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining("Speak") }));
    expect(voiceMocks.joinVoiceChannel).not.toHaveBeenCalled();
  });

  it("joins an eligible requester voice room and records the action", async () => {
    const connection = { joinConfig: { channelId: "voice-1" }, destroy: vi.fn() };
    voiceMocks.joinVoiceChannel.mockReturnValue(connection);
    const { interaction } = makeInteraction({ commandName: "join", voiceChannel: { id: "voice-1", name: "General" } });
    await handleVoiceConnectionCommand(interaction);
    expect(voiceMocks.joinVoiceChannel).toHaveBeenCalledWith(expect.objectContaining({ channelId: "voice-1", selfMute: false, selfDeaf: false }));
    expect(dbMocks.saveGuildSettings).toHaveBeenCalledWith(expect.objectContaining({ voiceConversationChannelId: "voice-1" }));
    expect(logMocks.logDiscordEvent).toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining("مجلساوي دخل") }));
  });

  it("does not reconnect when the bot is already in the requester voice room", async () => {
    voiceMocks.getVoiceConnection.mockReturnValue({ joinConfig: { channelId: "voice-1" }, destroy: vi.fn() });
    dbMocks.getGuildSettings.mockResolvedValue({ voiceConversationChannelId: "voice-1", voiceConversationRoleId: "consent-role" });
    const { interaction } = makeInteraction({ commandName: "join", voiceChannel: { id: "voice-1", name: "General" } });
    await handleVoiceConnectionCommand(interaction);
    expect(voiceMocks.joinVoiceChannel).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining("موجود مسبقاً") }));
  });

  it("automatically assigns the requester room before starting consent-gated conversation", async () => {
    const subscribe = vi.fn();
    const connection = { joinConfig: { channelId: "general-room" }, destroy: vi.fn(), receiver: { subscribe } };
    voiceMocks.joinVoiceChannel.mockReturnValue(connection);
    dbMocks.getGuildSettings.mockResolvedValue({ voiceConversationChannelId: "majlsawi-private-room", voiceConversationRoleId: "consent-role" });
    const { interaction } = makeInteraction({ commandName: "join", voiceChannel: { id: "general-room", name: "General" } });
    await handleVoiceConnectionCommand(interaction);
    expect(dbMocks.saveGuildSettings).toHaveBeenCalledWith(expect.objectContaining({ voiceConversationChannelId: "general-room" }));
    expect(conversationMocks.startDirectedVoiceConversation).toHaveBeenCalledWith(expect.objectContaining({ channelId: "general-room" }));
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("leaves an active voice connection and records the action", async () => {
    const connection = { joinConfig: { channelId: "voice-1" }, destroy: vi.fn() };
    voiceMocks.getVoiceConnection.mockReturnValue(connection);
    const { interaction } = makeInteraction({ commandName: "leave", voiceChannel: { id: "voice-1", name: "General" } });
    await handleVoiceConnectionCommand(interaction);
    expect(connection.destroy).toHaveBeenCalledOnce();
    expect(logMocks.logDiscordEvent).toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining("خرج من الروم") }));
  });
});
