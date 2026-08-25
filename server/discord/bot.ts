import {
  ActionRowBuilder,
  AttachmentBuilder,
  AuditLogEvent,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  type Guild,
  type GuildMember,
  type PermissionsBitField,
} from "discord.js";
import { entersState, getVoiceConnection, joinVoiceChannel, VoiceConnectionStatus } from "@discordjs/voice";
import {
  adjustMemberXp,
  createJailRecord,
  getActiveJailRecord,
  getActiveJailRecordById,
  getCommandRoleIds,
  getGuildSettings,
  isBlacklistedMember,
  parseJailRoles,
  recordModerationCase,
  releaseJailRecord,
  saveJailMessageId,
  saveGuildSettings,
  type ModerationCommandKey,
  type SavedJailRole,
} from "../db";
import { logDiscordEvent, type DiscordEntity } from "./logging";
import { createWelcomeCard } from "./welcomeCard";
import { deliverWelcomeCard } from "./welcomeDelivery";
import { authorizeAiAction, buildAiPolicyLogDetails, classifyMentionIntent, type AiActionProposal } from "./aiActionPolicy";
import { buildInteractionLogDetails } from "./interactionLogging";
import { buildGuardLogDetails, evaluateGuardWindow, hasConfiguredRoleAccess, planJailRoles, selectRestorableRoles } from "./securityRules";
import { playIndependentSpeech } from "./tts";
import { assessBotVoicePermissions, assessVoiceCommandState } from "./voiceCommandRules";
import { hasVoiceConversationConsent, shouldStartDirectedVoiceConversation, startDirectedVoiceConversation, stopDirectedVoiceConversation } from "./voiceConversation";

let client: Client | null = null;
let started = false;
let startedAt: Date | null = null;

type AuditActor = DiscordEntity & { reason?: string | null };

function entity(id?: string | null, label?: string | null): DiscordEntity {
  return { id: id ?? null, label: label ?? null };
}

function memberEntity(member: GuildMember) {
  return entity(member.id, `${member.user.username} (${member.displayName})`);
}

function channelLabel(channel: { name?: string | null; id?: string | null } | null | undefined) {
  return channel ? `#${channel.name ?? "unknown"} (\`${channel.id ?? "unknown"}\`)` : "Not connected";
}

function truncate(value?: string | null, max = 800) {
  if (!value) return "No content available";
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

async function logBotInteraction(input: {
  guild: Guild;
  eventKey: string;
  title: string;
  actorId?: string | null;
  actorLabel?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  details: Record<string, string>;
}) {
  await logDiscordEvent({
    ...input,
    category: "interactions",
    accentColor: "#C9A7FF",
    icon: "💬",
  });
}

function roleList(roles: SavedJailRole[]) {
  if (roles.length === 0) return "None";
  return truncate(roles.map(role => `@${role.name} (\`${role.id}\`)`).join(", "), 920);
}

async function canUseModerationAction(
  guild: Guild,
  userId: string,
  commandKey: ModerationCommandKey,
  fallbackPermission: bigint = PermissionFlagsBits.ModerateMembers,
) {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return false;
  const allowedRoleIds = await getCommandRoleIds(guild.id, commandKey);
  if (!hasConfiguredRoleAccess(allowedRoleIds, Array.from(member.roles.cache.keys()))) return false;
  if (allowedRoleIds.length > 0) return true;
  return member.permissions.has(fallbackPermission);
}

async function recentAuditActor(guild: Guild, action: AuditLogEvent, targetId: string): Promise<AuditActor> {
  try {
    const logs = await guild.fetchAuditLogs({ type: action, limit: 6 });
    const match = logs.entries.find(entry =>
      entry.targetId === targetId && Date.now() - entry.createdTimestamp < 10_000,
    );
    return match?.executor
      ? { ...entity(match.executor.id, match.executor.username), reason: match.reason }
      : entity();
  } catch {
    return entity();
  }
}

async function jailMember(guild: Guild, target: GuildMember, executor: DiscordEntity, reason: string) {
  const settings = await getGuildSettings(guild.id);
  if (!settings?.jailRoleId || !settings.jailChannelId) {
    throw new Error("Configure both the jail role and jail channel in the dashboard first.");
  }
  if (!executor.id || !executor.label) throw new Error("Unable to identify the executor.");
  if (await getActiveJailRecord(guild.id, target.id)) throw new Error("This member already has an active jail record.");

  const jailRole = guild.roles.cache.get(settings.jailRoleId);
  if (!jailRole || !jailRole.editable) throw new Error("The configured jail role is missing or is above the bot role.");
  const rolePlan = planJailRoles(
    Array.from(target.roles.cache.values()).map(role => ({ id: role.id, name: role.name, editable: role.editable })),
    guild.id,
    jailRole.id,
  );
  const { snapshot, removed, preserved } = rolePlan;
  const removable = removed.map(role => role.id);

  if (removable.length > 0) await target.roles.remove(removable, `Jail: ${reason}`);
  await target.roles.add(jailRole, `Jail: ${reason}`);
  const record = await createJailRecord({
    guildId: guild.id,
    memberId: target.id,
    memberLabel: target.displayName,
    jailedById: executor.id,
    jailedByLabel: executor.label,
    jailRoleId: jailRole.id,
    jailChannelId: settings.jailChannelId,
    reason,
    roles: snapshot,
  });
  if (!record) throw new Error("The jail record could not be stored.");

  const channel = await guild.channels.fetch(settings.jailChannelId);
  if (!channel?.isTextBased()) throw new Error("The configured jail channel is unavailable or is not text-based.");
  const releaseButton = new ButtonBuilder()
    .setCustomId(`jail:release:${record.id}`)
    .setLabel("فك السجن")
    .setEmoji("🔓")
    .setStyle(ButtonStyle.Success);
  const message = await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0xed4245)
        .setAuthor({ name: "🔒 مجلساوي • JAIL CASE" })
        .setTitle("تم سجن عضو")
        .setDescription(`العضو: <@${target.id}>\nالمنفذ: <@${executor.id}>`)
        .addFields(
          { name: "السبب", value: truncate(reason), inline: false },
          { name: "الرتب المسحوبة", value: roleList(removed), inline: false },
          { name: "رتبة السجن", value: `<@&${jailRole.id}>`, inline: true },
          { name: "حالة الحماية", value: preserved.length ? `تم الاحتفاظ بـ ${preserved.length} رتبة لا يستطيع البوت تعديلها.` : "تمت إزالة كل الرتب القابلة لتعديل البوت.", inline: false },
        )
        .setTimestamp()
        .setFooter({ text: `Jail record #${record.id}` }),
    ],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(releaseButton)],
    allowedMentions: { users: [target.id, executor.id], roles: [jailRole.id] },
  });
  await saveJailMessageId(record.id, message.id);
  await logDiscordEvent({
    guild,
    category: "moderation",
    eventKey: "moderation.jail",
    title: "Member jailed • roles secured",
    accentColor: "#ED4245",
    icon: "🔒",
    actorId: executor.id,
    actorLabel: executor.label,
    targetId: target.id,
    targetLabel: target.displayName,
    reason,
    details: {
      "Jail channel": `<#${settings.jailChannelId}>`,
      "Jail role": `${jailRole.name} (\`${jailRole.id}\`)`,
      "Removed roles": roleList(removed),
      "Preserved roles": roleList(preserved),
      "Release control": `Message \`${message.id}\``,
    },
  });
  return { record, jailRole, removed, preserved };
}

async function releaseJailedMember(guild: Guild, recordId: number, executor: DiscordEntity) {
  if (!executor.id || !executor.label) throw new Error("Unable to identify the executor.");
  const record = await getActiveJailRecordById(recordId);
  if (!record || record.guildId !== guild.id) throw new Error("This jail record is no longer active.");
  const member = await guild.members.fetch(record.memberId).catch(() => null);
  if (!member) throw new Error("The jailed member is no longer in this server.");
  const jailRole = guild.roles.cache.get(record.jailRoleId);
  if (jailRole?.editable && member.roles.cache.has(jailRole.id)) {
    await member.roles.remove(jailRole.id, `Released from jail by ${executor.label}`);
  }
  const savedRoles = parseJailRoles(record.rolesJson);
  const { restorable, unavailable } = selectRestorableRoles(
    savedRoles,
    Array.from(guild.roles.cache.values()).filter(role => role.editable).map(role => role.id),
  );
  if (restorable.length > 0) await member.roles.add(restorable.map(role => role.id), `Released from jail by ${executor.label}`);
  await releaseJailRecord({ recordId: record.id, releasedById: executor.id, releasedByLabel: executor.label });
  await recordModerationCase({ guildId: guild.id, action: "unjail", executorId: executor.id, executorLabel: executor.label, memberId: member.id, memberLabel: member.displayName, reason: `Released jail record #${record.id}` });
  await logDiscordEvent({
    guild,
    category: "moderation",
    eventKey: "moderation.unjail",
    title: "Member released • roles restored",
    accentColor: "#57F287",
    icon: "🔓",
    actorId: executor.id,
    actorLabel: executor.label,
    targetId: member.id,
    targetLabel: member.displayName,
    reason: record.reason,
    details: {
      "Jail record": `#${record.id}`,
      "Removed jail role": jailRole ? `${jailRole.name} (\`${jailRole.id}\`)` : `\`${record.jailRoleId}\``,
      "Restored roles": roleList(restorable),
      "Unavailable roles": roleList(unavailable),
    },
  });
  return { record, member, restorable, unavailable };
}

function commands() {
  const memberOption = (builder: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder) => builder.addUserOption(option => option.setName("member").setDescription("Member to manage").setRequired(true));
  const reasonOption = (builder: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder) => builder.addStringOption(option => option.setName("reason").setDescription("Reason recorded in the log").setRequired(false));
  const moderation = ["ban", "kick", "mute", "unmute", "deafen", "undeafen", "warn", "jail", "unjail"] as const;
  const actionCommands = moderation.map(action => {
    const builder = new SlashCommandBuilder()
      .setName(action)
      .setDescription(`${action[0].toUpperCase()}${action.slice(1)} a member with an auditable log`)
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);
    return reasonOption(memberOption(builder)).toJSON();
  });
  return [
    ...actionCommands,
    new SlashCommandBuilder()
      .setName("xp")
      .setDescription("Add or remove XP and record the action")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addUserOption(option => option.setName("member").setDescription("Member to update").setRequired(true))
      .addIntegerOption(option => option.setName("amount").setDescription("Positive to add, negative to remove").setRequired(true))
      .toJSON(),
    new SlashCommandBuilder()
      .setName("dashboard")
      .setDescription("Open the configured مجلساوي control panel")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .toJSON(),
    new SlashCommandBuilder()
      .setName("join")
      .setDescription("Join the voice channel you are currently in")
      .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
      .toJSON(),
    new SlashCommandBuilder()
      .setName("leave")
      .setDescription("Disconnect مجلساوي from voice")
      .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
      .toJSON(),
    new SlashCommandBuilder()
      .setName("say")
      .setDescription("Speak a short independent Arabic message in the bot voice channel")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addStringOption(option => option.setName("text").setDescription("Short text for the independent bot voice").setRequired(true).setMaxLength(280))
      .toJSON(),
  ];
}

async function recordModeration(
  guild: Guild,
  action: "ban" | "kick" | "mute" | "unmute" | "deafen" | "undeafen" | "warn" | "jail" | "unjail",
  executor: DiscordEntity,
  target: DiscordEntity,
  reason: string,
) {
  if (executor.id && executor.label && target.id && target.label) {
    await recordModerationCase({
      guildId: guild.id,
      action,
      executorId: executor.id,
      executorLabel: executor.label,
      memberId: target.id,
      memberLabel: target.label,
      reason,
    });
  }
  await logDiscordEvent({
    guild,
    category: "moderation",
    eventKey: `moderation.${action}`,
    title: `Moderation action • ${action.toUpperCase()}`,
    accentColor: "#ED4245",
    icon: "🛡️",
    actorId: executor.id,
    actorLabel: executor.label,
    targetId: target.id,
    targetLabel: target.label,
    reason,
    details: { "Guild": guild.name, "Action": action.toUpperCase() },
  });
}

async function handleModerationCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.member) return;
  const action = interaction.commandName as "ban" | "kick" | "mute" | "unmute" | "deafen" | "undeafen" | "warn" | "jail" | "unjail" | "xp";
  if (!["ban", "kick", "mute", "unmute", "deafen", "undeafen", "warn", "jail", "unjail", "xp"].includes(action)) return;

  const targetUser = interaction.options.getUser("member", true);
  const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
  const executor = entity(interaction.user.id, interaction.user.username);
  const reason = interaction.options.getString("reason") ?? "No reason provided";
  const requiredPermission = action === "xp" ? PermissionFlagsBits.ManageGuild : action === "jail" || action === "unjail" ? PermissionFlagsBits.ManageRoles : PermissionFlagsBits.ModerateMembers;
  if (!await canUseModerationAction(interaction.guild, interaction.user.id, action, requiredPermission)) {
    await interaction.reply({ content: "You do not have the configured role or permission for this command.", ephemeral: true });
    return;
  }
  if (!target && action !== "ban") {
    await interaction.reply({ content: "That member is no longer available in this server.", ephemeral: true });
    return;
  }

  if (action === "xp") {
    if (!target) {
      await interaction.reply({ content: "That member is no longer available in this server.", ephemeral: true });
      return;
    }
    const amount = interaction.options.getInteger("amount", true);
    const xp = await adjustMemberXp({
      guildId: interaction.guild.id,
      memberId: target.id,
      memberLabel: target.displayName,
      delta: amount,
    });
    await logDiscordEvent({
      guild: interaction.guild,
      category: "xp",
      eventKey: "xp.adjusted",
      title: "XP adjusted",
      accentColor: "#00D4AA",
      icon: "✨",
      actorId: executor.id,
      actorLabel: executor.label,
      targetId: target.id,
      targetLabel: target.displayName,
      details: { "Change": `${amount > 0 ? "+" : ""}${amount} XP`, "Current XP": `${xp.xp}`, "Level": `${xp.level}` },
    });
    await interaction.reply({ content: `${target} now has **${xp.xp} XP** at level **${xp.level}**.`, ephemeral: true });
    return;
  }

  try {
    switch (action) {
      case "ban":
        await interaction.guild.members.ban(targetUser.id, { reason });
        break;
      case "kick":
        await target!.kick(reason);
        break;
      case "mute":
        await target!.voice.setMute(true, reason);
        break;
      case "unmute":
        await target!.voice.setMute(false, reason);
        break;
      case "deafen":
        await target!.voice.setDeaf(true, reason);
        break;
      case "undeafen":
        await target!.voice.setDeaf(false, reason);
        break;
      case "warn":
        break;
      case "jail": {
        await jailMember(interaction.guild, target!, executor, reason);
        if (executor.id && executor.label) {
          await recordModerationCase({ guildId: interaction.guild.id, action: "jail", executorId: executor.id, executorLabel: executor.label, memberId: target!.id, memberLabel: target!.displayName, reason });
        }
        await interaction.reply({ content: `Jailed **${targetUser.username}**. Their roles, jail message, release button, and detailed logs were created.`, ephemeral: true });
        return;
      }
      case "unjail": {
        const record = await getActiveJailRecord(interaction.guild.id, target!.id);
        if (!record) throw new Error("This member does not have an active jail record.");
        await releaseJailedMember(interaction.guild, record.id, executor);
        await interaction.reply({ content: `Released **${targetUser.username}** and restored their saved roles.`, ephemeral: true });
        return;
      }
    }
    await recordModeration(interaction.guild, action, executor, target ? memberEntity(target) : entity(targetUser.id, targetUser.username), reason);
    await interaction.reply({ content: `Completed **${action}** for **${targetUser.username}**. A detailed log has been recorded.`, ephemeral: true });
  } catch (error) {
    await interaction.reply({ content: `I could not complete that action: ${error instanceof Error ? error.message : "Unknown error"}`, ephemeral: true });
  }
}

async function handleDashboardCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: "You do not have permission to access the control panel link.", ephemeral: true });
    return;
  }
  const settings = await getGuildSettings(interaction.guild.id);
  if (!settings?.dashboardUrl) {
    await interaction.reply({ content: "No dashboard URL has been configured yet. Add it from the moderation and protection settings.", ephemeral: true });
    return;
  }
  let url: URL;
  try {
    url = new URL(settings.dashboardUrl);
  } catch {
    await interaction.reply({ content: "The configured dashboard URL is invalid. Update it from the dashboard settings.", ephemeral: true });
    return;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    await interaction.reply({ content: "The configured dashboard URL must use HTTPS or HTTP.", ephemeral: true });
    return;
  }
  const openButton = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("فتح لوحة التحكم").setEmoji("🛡️").setURL(url.toString());
  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setAuthor({ name: "مجلساوي • CONTROL PANEL" })
        .setTitle("لوحة التحكم")
        .setDescription("استخدم الزر أدناه لفتح لوحة إدارة اللوقات والحماية والسجن.")
        .addFields({ name: "السيرفر", value: interaction.guild.name, inline: true })
        .setTimestamp(),
    ],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(openButton)],
    ephemeral: true,
  });
  await logBotInteraction({
    guild: interaction.guild,
    eventKey: "dashboard.link.shared",
    title: "Control-panel link shared",
    actorId: interaction.user.id,
    actorLabel: interaction.user.username,
    details: buildInteractionLogDetails({ kind: "slash_command", channelId: interaction.channelId, command: "/dashboard", outcome: "completed" }),
  });
}

export async function handleVoiceConnectionCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  if (await isBlacklistedMember(interaction.guild.id, interaction.user.id)) return;
  const action = interaction.commandName as "join" | "leave";
  const allowed = await canUseModerationAction(interaction.guild, interaction.user.id, action, PermissionFlagsBits.MoveMembers);
  if (!allowed) {
    await interaction.reply({ content: "You do not have the configured role or permission for this voice command.", ephemeral: true });
    return;
  }
  const requester = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!requester) {
    await interaction.reply({ content: "Your server membership could not be verified.", ephemeral: true });
    return;
  }
  const commandState = assessVoiceCommandState({
    authorized: true,
    action,
    requesterVoiceChannelId: requester.voice.channelId,
    botVoiceChannelId: getVoiceConnection(interaction.guild.id)?.joinConfig.channelId ?? null,
  });
  if (!commandState.allowed) {
    await interaction.reply({ content: commandState.message, ephemeral: true });
    return;
  }
  if (action === "leave") {
    const connection = getVoiceConnection(interaction.guild.id);
    if (!connection) {
      await interaction.reply({ content: "مجلساوي ليس متصلاً بروم صوتي.", ephemeral: true });
      return;
    }
    const previousChannel = connection.joinConfig.channelId ? interaction.guild.channels.cache.get(connection.joinConfig.channelId) : null;
    stopDirectedVoiceConversation(interaction.guild.id);
    connection.destroy();
    await logDiscordEvent({
      guild: interaction.guild,
      category: "voice",
      eventKey: "bot.voice.left",
      title: "مجلساوي left voice",
      accentColor: "#5865F2",
      icon: "👋",
      actorId: interaction.user.id,
      actorLabel: requester.displayName,
      details: { "Channel": channelLabel(previousChannel), "Command": "/leave" },
    });
    await logBotInteraction({
      guild: interaction.guild,
      eventKey: "bot.voice.leave.completed",
      title: "Bot voice action completed",
      actorId: interaction.user.id,
      actorLabel: requester.displayName,
      details: buildInteractionLogDetails({ kind: "voice_action", channelId: previousChannel?.id, command: "/leave", outcome: "completed" }),
    });
    await interaction.reply({ content: "مجلساوي خرج من الروم الصوتي.", ephemeral: true });
    return;
  }
  const voiceChannel = requester.voice.channel;
  if (!voiceChannel) {
    await interaction.reply({ content: "Join a voice channel first, then run /join.", ephemeral: true });
    return;
  }
  const botMember = interaction.guild.members.me ?? await interaction.guild.members.fetchMe().catch(() => null);
  const permissions = botMember ? voiceChannel.permissionsFor(botMember) : null;
  const voicePermissionDecision = assessBotVoicePermissions({
    canConnect: Boolean(permissions?.has(PermissionFlagsBits.Connect)),
    canSpeak: Boolean(permissions?.has(PermissionFlagsBits.Speak)),
  });
  if (!voicePermissionDecision.allowed) {
    await interaction.reply({ content: voicePermissionDecision.message, ephemeral: true });
    return;
  }
  const storedVoiceSettings = await getGuildSettings(interaction.guild.id);
  const dedicatedRoomChanged = storedVoiceSettings?.voiceConversationChannelId !== voiceChannel.id;
  if (dedicatedRoomChanged) {
    await saveGuildSettings({
      guildId: interaction.guild.id,
      guildName: interaction.guild.name,
      voiceConversationChannelId: voiceChannel.id,
    });
  }
  const voiceSettings = dedicatedRoomChanged
    ? { ...storedVoiceSettings, voiceConversationChannelId: voiceChannel.id }
    : storedVoiceSettings;
  const existing = getVoiceConnection(interaction.guild.id);
  if (existing?.joinConfig.channelId === voiceChannel.id && !dedicatedRoomChanged) {
    await interaction.reply({ content: "مجلساوي موجود مسبقاً في رومك الصوتي وهذا هو روم المحادثة المخصص.", ephemeral: true });
    return;
  }
  if (existing) {
    stopDirectedVoiceConversation(interaction.guild.id);
    existing.destroy();
  }
  try {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: interaction.guild.id,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });
    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    if (shouldStartDirectedVoiceConversation(voiceSettings?.voiceConversationChannelId, voiceChannel.id) && voiceSettings?.voiceConversationRoleId) {
      await startDirectedVoiceConversation({
        guild: interaction.guild,
        connection,
        channelId: voiceChannel.id,
        isMemberBlacklisted: memberId => isBlacklistedMember(interaction.guild!.id, memberId),
        hasMemberVoiceConsent: async memberId => {
          const member = await interaction.guild!.members.fetch(memberId).catch(() => null);
          return hasVoiceConversationConsent(voiceSettings.voiceConversationRoleId, member ? Array.from(member.roles.cache.keys()) : []);
        },
        onEvent: async event => {
        if (event.type === "ready") {
          await logBotInteraction({
            guild: interaction.guild!,
            eventKey: "voice.conversation.ready",
            title: "Directed voice conversation ready",
            targetId: voiceChannel.id,
            targetLabel: voiceChannel.name,
            details: { "Wake name": "مجلساوي", "Privacy": "Raw audio and transcripts are not persisted" },
          });
          return;
        }
        if (event.type === "reply_started") {
          await logBotInteraction({
            guild: interaction.guild!,
            eventKey: "voice.conversation.replied",
            title: "Majlsawi voice reply started",
            targetId: event.channelId,
            targetLabel: voiceChannel.name,
            details: buildInteractionLogDetails({ kind: "voice_action", channelId: event.channelId, command: "voice conversation", outcome: "completed" }),
          });
          return;
        }
        await logDiscordEvent({
          guild: interaction.guild!,
          category: "system",
          eventKey: event.type === "unavailable" ? "voice.conversation.unavailable" : "voice.conversation.failed",
          title: event.type === "unavailable" ? "Voice conversation is not configured" : "Voice conversation failed",
          accentColor: "#FEE75C",
          icon: "🎙️",
          targetId: voiceChannel.id,
          targetLabel: voiceChannel.name,
          details: { "Status": event.reason, "Privacy": "No raw audio or transcript retained" },
        });
        },
      });
    } else {
      await logBotInteraction({
        guild: interaction.guild,
        eventKey: "voice.conversation.not_enabled_for_channel",
        title: "Voice conversation not enabled for this room",
        targetId: voiceChannel.id,
        targetLabel: voiceChannel.name,
        details: { "Privacy": "No voice is captured or transcribed outside the configured Majlsawi room and the explicit consent role" },
      });
    }
    await logDiscordEvent({
      guild: interaction.guild,
      category: "voice",
      eventKey: "bot.voice.joined",
      title: "مجلساوي joined voice",
      accentColor: "#5865F2",
      icon: "🎧",
      actorId: interaction.user.id,
      actorLabel: requester.displayName,
      targetId: voiceChannel.id,
      targetLabel: voiceChannel.name,
      details: { "Channel": channelLabel(voiceChannel), "Command": "/join", "Audio": "Replies only after the wake name مجلساوي; raw audio is not retained" },
    });
    await logBotInteraction({
      guild: interaction.guild,
      eventKey: "bot.voice.join.completed",
      title: "Bot voice action completed",
      actorId: interaction.user.id,
      actorLabel: requester.displayName,
      targetId: voiceChannel.id,
      targetLabel: voiceChannel.name,
      details: buildInteractionLogDetails({ kind: "voice_action", channelId: voiceChannel.id, command: "/join", outcome: "completed" }),
    });
    await interaction.reply({ content: `مجلساوي دخل روم **${voiceChannel.name}** واعتمده تلقائياً لروم المحادثة المخصص.`, ephemeral: true });
  } catch (error) {
    getVoiceConnection(interaction.guild.id)?.destroy();
    await interaction.reply({ content: `I could not join your voice channel: ${error instanceof Error ? error.message : "Unknown error"}`, ephemeral: true });
  }
}

async function handleSpeechCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  if (await isBlacklistedMember(interaction.guild.id, interaction.user.id)) return;
  const allowed = await canUseModerationAction(interaction.guild, interaction.user.id, "say", PermissionFlagsBits.ManageGuild);
  if (!allowed) {
    await interaction.reply({ content: "You do not have the configured role or permission for /say.", ephemeral: true });
    return;
  }
  const requester = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  const connection = getVoiceConnection(interaction.guild.id);
  const requesterVoiceChannel = requester?.voice.channel ?? null;
  const commandState = assessVoiceCommandState({
    authorized: true,
    action: "say",
    requesterVoiceChannelId: requesterVoiceChannel?.id,
    botVoiceChannelId: connection?.joinConfig.channelId ?? null,
  });
  if (!requester || !connection || !requesterVoiceChannel || !commandState.allowed) {
    try {
      if (interaction.deferred) await interaction.editReply(commandState.allowed ? "ادخل الروم الصوتي ثم استخدم /join قبل /say." : commandState.message);
      else if (!interaction.replied) await interaction.reply({ content: commandState.allowed ? "ادخل الروم الصوتي ثم استخدم /join قبل /say." : commandState.message, ephemeral: true });
    } catch (error) {
      if (!(typeof error === "object" && error && "code" in error && error.code === 40060)) throw error;
      console.warn("[Discord] /say reply was already acknowledged by another active instance.");
    }
    return;
  }
  const text = interaction.options.getString("text", true);
  await interaction.deferReply({ ephemeral: true });
  try {
    const result = await playIndependentSpeech({ guildId: interaction.guild.id, connection, text });
    await logDiscordEvent({
      guild: interaction.guild,
      category: "voice",
      eventKey: result.queued ? "bot.tts.queued" : "bot.tts.started",
      title: result.queued ? "Independent bot speech queued" : "Independent bot speech started",
      accentColor: "#5865F2",
      icon: "🗣️",
      actorId: interaction.user.id,
      actorLabel: requester.displayName,
      targetId: requesterVoiceChannel.id,
      targetLabel: requesterVoiceChannel.name,
      details: { "Command": "/say", "Channel": channelLabel(requesterVoiceChannel), "Characters": `${result.characters}`, "Playback": result.queued ? "Queued in memory" : "Started", "Voice": "Independent Arabic voice; no reference audio used" },
    });
    await logBotInteraction({
      guild: interaction.guild,
      eventKey: result.queued ? "bot.tts.queued" : "bot.tts.started",
      title: result.queued ? "Bot speech action queued" : "Bot speech action started",
      actorId: interaction.user.id,
      actorLabel: requester.displayName,
      targetId: requesterVoiceChannel.id,
      targetLabel: requesterVoiceChannel.name,
      details: buildInteractionLogDetails({ kind: "voice_action", channelId: requesterVoiceChannel.id, command: "/say", outcome: result.queued ? "received" : "completed" }),
    });
    await interaction.editReply(result.queued ? "أضيف المقطع إلى طابور النطق الآمن. لا يتم حفظ نص /say في اللوقات." : "بدأ البوت النطق في الروم. لا يتم حفظ نص /say في اللوقات.");
  } catch (error) {
    await logBotInteraction({
      guild: interaction.guild,
      eventKey: "bot.tts.failed",
      title: "Bot speech action failed",
      actorId: interaction.user.id,
      actorLabel: requester.displayName,
      details: buildInteractionLogDetails({ kind: "voice_action", channelId: requesterVoiceChannel.id, command: "/say", outcome: "failed" }),
    });
    await interaction.editReply(error instanceof Error ? error.message : "تعذر تشغيل الصوت.");
  }
}

async function handleJailReleaseButton(interaction: ButtonInteraction) {
  if (!interaction.guild || !interaction.customId.startsWith("jail:release:")) return;
  const recordId = Number(interaction.customId.split(":")[2]);
  if (!Number.isInteger(recordId)) return;
  const allowed = await canUseModerationAction(interaction.guild, interaction.user.id, "release_jail", PermissionFlagsBits.ManageRoles);
  if (!allowed) {
    await interaction.reply({ content: "You do not have the configured role or permission to release a jailed member.", ephemeral: true });
    return;
  }
  try {
    const released = await releaseJailedMember(interaction.guild, recordId, entity(interaction.user.id, interaction.user.username));
    const disabledButton = new ButtonBuilder()
      .setCustomId(interaction.customId)
      .setLabel("تم فك السجن")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);
    await interaction.update({ components: [new ActionRowBuilder<ButtonBuilder>().addComponents(disabledButton)] });
    await interaction.followUp({ content: `تم فك سجن **${released.member.displayName}** واستعادة ${released.restorable.length} رتبة.`, ephemeral: true });
  } catch (error) {
    await interaction.reply({ content: `I could not release this jail case: ${error instanceof Error ? error.message : "Unknown error"}`, ephemeral: true });
  }
}

const guardWindows = new Map<string, number[]>();

async function enforceServerGuard(
  guild: Guild,
  scope: "roles" | "channels" | "bans",
  actor: AuditActor,
  affectedLabel: string,
) {
  const settings = await getGuildSettings(guild.id);
  if (!settings?.guardEnabled || !actor.id || actor.id === guild.ownerId || actor.id === client?.user?.id) return;
  const bypassRoleIds = await getCommandRoleIds(guild.id, "guard_bypass");
  const actorMember = await guild.members.fetch(actor.id).catch(() => null);
  if (!actorMember) return;
  if (bypassRoleIds.length > 0 && actorMember.roles.cache.some(role => bypassRoleIds.includes(role.id))) return;

  const limit = scope === "roles" ? settings.guardMaxRoleChanges : scope === "channels" ? settings.guardMaxChannelChanges : settings.guardMaxBans;
  const key = `${guild.id}:${actor.id}:${scope}`;
  const now = Date.now();
  const windowMs = settings.guardWindowSeconds * 1000;
  const guardDecision = evaluateGuardWindow(guardWindows.get(key) ?? [], now, windowMs, limit);
  const activity = guardDecision.active;
  guardWindows.set(key, activity);
  if (!guardDecision.triggered) return;

  const removable = actorMember.roles.cache.filter(role => role.id !== guild.id && role.editable).map(role => role.id);
  if (removable.length > 0) {
  await actorMember.roles.remove(removable, `مجلساوي guard: ${scope} threshold exceeded`);
  }
  guardWindows.set(key, []);
  await logDiscordEvent({
    guild,
    category: "system",
    eventKey: `guard.${scope}.triggered`,
    title: "Server protection triggered",
    accentColor: "#ED4245",
    icon: "🚨",
    actorId: actor.id,
    actorLabel: actor.label,
    targetId: actor.id,
    targetLabel: actor.label,
    reason: `Exceeded ${limit} ${scope} changes within ${settings.guardWindowSeconds} seconds.`,
    details: buildGuardLogDetails({
      scope,
      limit,
      windowSeconds: settings.guardWindowSeconds,
      affectedLabel,
      removedRoleCount: removable.length,
      bypassConfigured: bypassRoleIds.length > 0,
    }),
  });
}

export function getDiscordStatus() {
  return {
    configured: Boolean(process.env.DISCORD_BOT_TOKEN),
    connected: Boolean(client?.isReady()),
    botName: client?.user?.username ?? null,
    botId: client?.user?.id ?? null,
    startedAt: startedAt?.toISOString() ?? null,
    guildCount: client?.guilds.cache.size ?? 0,
  };
}

export function listConnectedGuilds() {
  return client ? Array.from(client.guilds.cache.values()).map(guild => ({ id: guild.id, name: guild.name })) : [];
}

export async function logBlacklistAdministration(input: {
  guildId: string;
  memberId: string;
  actorId: string;
  actorLabel: string;
  action: "added" | "removed";
}) {
  const guild = client?.guilds.cache.get(input.guildId);
  if (!guild) return;
  const member = await guild.members.fetch(input.memberId).catch(() => null);
  await logBotInteraction({
    guild,
    eventKey: `blacklist.member.${input.action}`,
    title: input.action === "added" ? "Member added to bot blacklist" : "Member removed from bot blacklist",
    actorId: input.actorId,
    actorLabel: input.actorLabel,
    targetId: input.memberId,
    targetLabel: member?.displayName ?? input.memberId,
    details: { "Action": input.action, "Policy": "No bot responses, voice actions, or wake-name processing while blocked" },
  });
}

export async function listGuildTextChannels(guildId: string) {
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) return [];
  const channels = await guild.channels.fetch().catch(() => guild.channels.cache);
  const botMember = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
  return Array.from(channels.values())
    .filter((channel): channel is NonNullable<typeof channel> => Boolean(channel && (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)))
    .filter(channel => {
      const permissions = botMember ? channel.permissionsFor(botMember) : null;
      return Boolean(permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]));
    })
    .map(channel => ({ id: channel.id, name: channel.name, type: channel.type }));
}

export function isEligibleGuildVoiceChannel(
  channel: { type: ChannelType; permissionsFor: (member: GuildMember) => Pick<Readonly<PermissionsBitField>, "has"> | null },
  botMember: GuildMember,
) {
  if (channel.type !== ChannelType.GuildVoice) return false;
  return Boolean(channel.permissionsFor(botMember)?.has([
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.Connect,
    PermissionFlagsBits.Speak,
  ]));
}

export async function listGuildVoiceChannels(guildId: string) {
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) return [];
  const channels = await guild.channels.fetch().catch(() => guild.channels.cache);
  const botMember = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
  if (!botMember) return [];
  return Array.from(channels.values())
    .filter((channel): channel is NonNullable<typeof channel> => Boolean(channel))
    .filter(channel => isEligibleGuildVoiceChannel(channel, botMember))
    .map(channel => ({ id: channel.id, name: channel.name, type: channel.type }));
}

export function listGuildRoles(guildId: string) {
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) return [];
  return Array.from(guild.roles.cache.values())
    .filter(role => role.id !== guild.id)
    .sort((left, right) => right.position - left.position)
    .map(role => ({ id: role.id, name: role.name, color: role.hexColor, editable: role.editable }));
}

export async function sendWelcomeCardPreview(guildId: string) {
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) throw new Error("The selected server is not connected to the bot.");
  const settings = await getGuildSettings(guildId);
  if (!settings?.welcomeChannelId) throw new Error("Select a welcome channel before sending a preview.");
  const channel = await guild.channels.fetch(settings.welcomeChannelId);
  if (!channel?.isTextBased()) throw new Error("The configured welcome channel cannot receive messages.");
  const previewMember = await guild.members.fetch(guild.ownerId).catch(() => null);
  const memberName = previewMember?.displayName ?? "عضو جديد";
  const avatarUrl = previewMember?.displayAvatarURL({ extension: "png", size: 512 }) ?? client?.user?.displayAvatarURL({ extension: "png", size: 512 }) ?? "";
  const message = (settings.welcomeMessage || "مرحباً {user} في {server}!")
    .replace("{user}", "@عضو جديد")
    .replace("{server}", guild.name);
  const card = await createWelcomeCard({ guildName: guild.name, memberName, avatarUrl, message });
  await channel.send({
    content: "**معاينة بطاقة الترحيب** — سيظهر الاسم والصورة الحقيقيان للعضو عند انضمامه.",
    files: [new AttachmentBuilder(card, { name: "welcome-preview.png" })],
  });
  await logDiscordEvent({
    guild,
    category: "welcome",
    eventKey: "welcome.card.previewed",
    title: "Welcome card preview sent",
    accentColor: "#57F287",
    icon: "🖼️",
    details: { "Destination": `<#${settings.welcomeChannelId}>`, "Delivery": "Dynamic PNG preview" },
  });
  return { channelId: settings.welcomeChannelId };
}

export async function executeApprovedAiVoiceAction(input: {
  guildId: string;
  proposal: AiActionProposal;
  requestedById: string;
  requestedByLabel: string;
}) {
  const decision = authorizeAiAction(input.proposal);
  const guild = client?.guilds.cache.get(input.guildId);
  if (!guild) throw new Error("The target server is not connected.");
  if (!decision.allowed) {
    await logBotInteraction({
      guild,
      eventKey: "ai.request.rejected",
      title: "AI request blocked by safety policy",
      actorId: input.requestedById,
      actorLabel: input.requestedByLabel,
      details: buildInteractionLogDetails({ kind: "mention", command: "AI voice request", outcome: "blocked", policy: "administrative_or_destructive" }),
    });
    return decision;
  }
  const member = await guild.members.fetch(decision.targetMemberId).catch(() => null);
  if (!member) throw new Error("The target member is not available in this server.");
  switch (decision.action) {
    case "mute": await member.voice.setMute(true, "Approved AI voice action"); break;
    case "unmute": await member.voice.setMute(false, "Approved AI voice action"); break;
    case "deafen": await member.voice.setDeaf(true, "Approved AI voice action"); break;
    case "undeafen": await member.voice.setDeaf(false, "Approved AI voice action"); break;
    case "move": await member.voice.setChannel(decision.destinationChannelId!, "Approved AI voice action"); break;
  }
  await logDiscordEvent({
    guild,
    category: "voice",
    eventKey: `ai.voice.${decision.action}`,
    title: "Approved AI voice action completed",
    accentColor: "#5865F2",
    icon: "🤖",
    actorId: input.requestedById,
    actorLabel: input.requestedByLabel,
    targetId: member.id,
    targetLabel: member.displayName,
    details: buildAiPolicyLogDetails({ intent: "voice_request", action: decision.action }),
  });
  await logBotInteraction({
    guild,
    eventKey: `ai.voice.${decision.action}.completed`,
    title: "Approved bot voice action completed",
    actorId: input.requestedById,
    actorLabel: input.requestedByLabel,
    targetId: member.id,
    targetLabel: member.displayName,
    details: buildInteractionLogDetails({ kind: "voice_action", command: `AI ${decision.action}`, outcome: "completed", policy: "safe_voice_only" }),
  });
  return decision;
}

export function startDiscordBot() {
  if (started || !process.env.DISCORD_BOT_TOKEN) return;
  started = true;
  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
    ],
  });

  client.once(Events.ClientReady, async readyClient => {
    startedAt = new Date();
    try {
      await readyClient.application.commands.set(commands());
      for (const guild of Array.from(readyClient.guilds.cache.values())) {
        await saveGuildSettings({ guildId: guild.id, guildName: guild.name });
      }
    } catch (error) {
      console.warn("[Discord] Slash command registration failed", error);
    }
  });

  client.on(Events.GuildCreate, guild => {
    void saveGuildSettings({ guildId: guild.id, guildName: guild.name });
  });

  client.on(Events.GuildMemberAdd, member => {
    void (async () => {
      await logDiscordEvent({
        guild: member.guild,
        category: "members",
        eventKey: "member.joined",
        title: "Member joined the server",
        accentColor: "#57F287",
        icon: "↗️",
        targetId: member.id,
        targetLabel: member.user.username,
        details: { "Account created": `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, "Member count": `${member.guild.memberCount}` },
      });
      const settings = await getGuildSettings(member.guild.id);
      if (!settings?.welcomeEnabled || !settings.welcomeChannelId) return;
      const channel = await member.guild.channels.fetch(settings.welcomeChannelId);
      if (!channel?.isTextBased()) return;
      const message = (settings.welcomeMessage || "مرحباً {user} في {server}!")
        .replace("{user}", `<@${member.id}>`)
        .replace("{server}", member.guild.name);
      const delivery = await deliverWelcomeCard({
        memberId: member.id,
        fallbackContent: message,
        card: {
          guildName: member.guild.name,
          memberName: member.displayName,
          avatarUrl: member.displayAvatarURL({ extension: "png", size: 512 }),
          message,
        },
        send: payload => channel.send(payload),
      });
      await logDiscordEvent({
        guild: member.guild,
        category: "welcome",
        eventKey: "welcome.sent",
        title: "Welcome message delivered",
        accentColor: "#57F287",
        icon: "👋",
        targetId: member.id,
        targetLabel: member.user.username,
        details: { "Destination": `<#${settings.welcomeChannelId}>`, "Delivery": delivery },
      });
    })();
  });

  client.on(Events.GuildMemberRemove, member => {
    void (async () => {
      const actor = await recentAuditActor(member.guild, AuditLogEvent.MemberKick, member.id);
      await logDiscordEvent({
        guild: member.guild,
        category: "members",
        eventKey: actor.id ? "member.kicked" : "member.left",
        title: actor.id ? "Member removed from the server" : "Member left the server",
        accentColor: actor.id ? "#ED4245" : "#99AAB5",
        icon: actor.id ? "⤴️" : "↘️",
        actorId: actor.id,
        actorLabel: actor.label,
        targetId: member.id,
        targetLabel: member.user.username,
        reason: actor.reason,
        details: { "Member count": `${member.guild.memberCount}` },
      });
    })();
  });

  client.on(Events.GuildBanAdd, ban => {
    void (async () => {
      const actor = await recentAuditActor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
      await logDiscordEvent({
        guild: ban.guild,
        category: "moderation",
        eventKey: "moderation.ban",
        title: "Member banned from the server",
        accentColor: "#ED4245",
        icon: "🔨",
        actorId: actor.id,
        actorLabel: actor.label,
        targetId: ban.user.id,
        targetLabel: ban.user.username,
        reason: actor.reason,
        details: { "Audit source": actor.id ? "Discord Audit Log" : "Gateway event" },
      });
      await enforceServerGuard(ban.guild, "bans", actor, `Ban of ${ban.user.username} (${ban.user.id})`);
    })();
  });

  client.on(Events.VoiceStateUpdate, (before, after) => {
    void (async () => {
      const target = entity(after.id, after.member?.user.username ?? before.member?.user.username);
      if (before.channelId !== after.channelId) {
        const actor: AuditActor = before.channelId && after.channelId ? await recentAuditActor(after.guild, AuditLogEvent.MemberMove, after.id) : entity();
        const action = !before.channelId ? "joined" : !after.channelId ? "left" : "moved";
        await logDiscordEvent({
          guild: after.guild,
          category: "voice",
          eventKey: `voice.${action}`,
          title: `Voice activity • member ${action}`,
          accentColor: "#5865F2",
          icon: action === "moved" ? "↔️" : action === "joined" ? "🔊" : "🔇",
          actorId: actor.id,
          actorLabel: actor.label,
          targetId: target.id,
          targetLabel: target.label,
          reason: actor.reason,
          details: { "From": channelLabel(before.channel), "To": channelLabel(after.channel), "Moved by": actor.id ? actor.label ?? "Unknown" : "Self / not available" },
        });
      }
      if (before.serverMute !== after.serverMute || before.serverDeaf !== after.serverDeaf) {
        const actor = await recentAuditActor(after.guild, AuditLogEvent.MemberUpdate, after.id);
        const change = before.serverMute !== after.serverMute ? (after.serverMute ? "Server mute enabled" : "Server mute removed") : (after.serverDeaf ? "Server deafening enabled" : "Server deafening removed");
        await logDiscordEvent({
          guild: after.guild,
          category: "voice",
          eventKey: "voice.administrative_change",
          title: "Administrative voice change",
          accentColor: "#5865F2",
          icon: "🎛️",
          actorId: actor.id,
          actorLabel: actor.label,
          targetId: target.id,
          targetLabel: target.label,
          reason: actor.reason,
          details: { "Change": change, "Channel": channelLabel(after.channel) },
        });
      }
    })();
  });

  client.on(Events.MessageDelete, message => {
    if (!message.guild || message.author?.bot) return;
    void logDiscordEvent({
      guild: message.guild,
      category: "messages",
      eventKey: "message.deleted",
      title: "Message deleted",
      accentColor: "#FAA61A",
      icon: "🗑️",
      targetId: message.author?.id,
      targetLabel: message.author?.username,
      details: { "Channel": `<#${message.channelId}>`, "Deleted content": truncate(message.content) },
    });
  });

  client.on(Events.MessageUpdate, (before, after) => {
    if (!after.guild || after.author?.bot || before.content === after.content) return;
    void logDiscordEvent({
      guild: after.guild,
      category: "messages",
      eventKey: "message.edited",
      title: "Message edited",
      accentColor: "#FAA61A",
      icon: "✏️",
      targetId: after.author?.id,
      targetLabel: after.author?.username,
      details: { "Channel": `<#${after.channelId}>`, "Before": truncate(before.content), "After": truncate(after.content) },
    });
  });

  client.on(Events.ChannelCreate, channel => {
    if (!channel.guild) return;
    void (async () => {
      const actor = await recentAuditActor(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
      await logDiscordEvent({
        guild: channel.guild,
        category: "channels",
        eventKey: "channel.created",
        title: "Channel created",
        accentColor: "#EB459E",
        icon: "#️⃣",
        actorId: actor.id,
        actorLabel: actor.label,
        targetId: channel.id,
        targetLabel: channel.name,
        reason: actor.reason,
        details: { "Type": `${channel.type}` },
      });
      await enforceServerGuard(channel.guild, "channels", actor, `Created channel #${channel.name}`);
    })();
  });

  client.on(Events.ChannelDelete, channel => {
    if (channel.isDMBased()) return;
    void (async () => {
      const actor = await recentAuditActor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
      await logDiscordEvent({
        guild: channel.guild,
        category: "channels",
        eventKey: "channel.deleted",
        title: "Channel deleted",
        accentColor: "#ED4245",
        icon: "🗑️",
        actorId: actor.id,
        actorLabel: actor.label,
        targetId: channel.id,
        targetLabel: channel.name,
        reason: actor.reason,
        details: { "Type": `${channel.type}` },
      });
      await enforceServerGuard(channel.guild, "channels", actor, `Deleted channel #${channel.name}`);
    })();
  });

  client.on(Events.ChannelUpdate, (before, after) => {
    if (before.isDMBased() || after.isDMBased() || before.name === after.name) return;
    void (async () => {
      const actor = await recentAuditActor(after.guild, AuditLogEvent.ChannelUpdate, after.id);
      await logDiscordEvent({
        guild: after.guild,
        category: "channels",
        eventKey: "channel.updated",
        title: "Channel updated",
        accentColor: "#EB459E",
        icon: "✏️",
        actorId: actor.id,
        actorLabel: actor.label,
        targetId: after.id,
        targetLabel: after.name,
        reason: actor.reason,
        details: { "Before": before.name, "After": after.name },
      });
      await enforceServerGuard(after.guild, "channels", actor, `Updated channel #${after.name}`);
    })();
  });

  client.on(Events.GuildRoleCreate, role => {
    void (async () => {
      const actor = await recentAuditActor(role.guild, AuditLogEvent.RoleCreate, role.id);
      await logDiscordEvent({ guild: role.guild, category: "roles", eventKey: "role.created", title: "Role created", accentColor: "#FEE75C", icon: "🏷️", actorId: actor.id, actorLabel: actor.label, targetId: role.id, targetLabel: role.name, reason: actor.reason, details: { "Color": role.hexColor } });
      await enforceServerGuard(role.guild, "roles", actor, `Created role ${role.name}`);
    })();
  });

  client.on(Events.GuildRoleDelete, role => {
    void (async () => {
      const actor = await recentAuditActor(role.guild, AuditLogEvent.RoleDelete, role.id);
      await logDiscordEvent({ guild: role.guild, category: "roles", eventKey: "role.deleted", title: "Role deleted", accentColor: "#ED4245", icon: "🏷️", actorId: actor.id, actorLabel: actor.label, targetId: role.id, targetLabel: role.name, reason: actor.reason, details: { "Color": role.hexColor } });
      await enforceServerGuard(role.guild, "roles", actor, `Deleted role ${role.name}`);
    })();
  });

  client.on(Events.GuildRoleUpdate, (before, after) => {
    if (before.name === after.name && before.hexColor === after.hexColor) return;
    void (async () => {
      const actor = await recentAuditActor(after.guild, AuditLogEvent.RoleUpdate, after.id);
      await logDiscordEvent({ guild: after.guild, category: "roles", eventKey: "role.updated", title: "Role updated", accentColor: "#FEE75C", icon: "🏷️", actorId: actor.id, actorLabel: actor.label, targetId: after.id, targetLabel: after.name, reason: actor.reason, details: { "Name before": before.name, "Name after": after.name, "Color before": before.hexColor, "Color after": after.hexColor } });
      await enforceServerGuard(after.guild, "roles", actor, `Updated role ${after.name}`);
    })();
  });

  client.on(Events.GuildMemberUpdate, (before, after) => {
    if (before.displayName === after.displayName && before.roles.cache.size === after.roles.cache.size) return;
    void logDiscordEvent({
      guild: after.guild,
      category: "members",
      eventKey: "member.updated",
      title: "Member profile or role state changed",
      accentColor: "#57F287",
      icon: "👤",
      targetId: after.id,
      targetLabel: after.user.username,
      details: { "Display name before": before.displayName, "Display name after": after.displayName, "Roles before": `${before.roles.cache.size - 1}`, "Roles after": `${after.roles.cache.size - 1}` },
    });
  });

  client.on(Events.MessageCreate, message => {
    if (!message.guild || message.author.bot) return;
    void (async () => {
      const isBotMentioned = Boolean(client?.user && message.mentions.has(client.user));
      const dashboardTextCommand = message.content
        .replaceAll(`<@${client?.user?.id ?? ""}>`, "")
        .replaceAll(`<@!${client?.user?.id ?? ""}>`, "")
        .trim()
        .toLowerCase();
      const isBlacklisted = (isBotMentioned || ["لوحة التحكم", "dashboard", "!dashboard"].includes(dashboardTextCommand))
        ? await isBlacklistedMember(message.guild!.id, message.author.id)
        : false;
      if (isBlacklisted) return;
      if (["لوحة التحكم", "dashboard", "!dashboard"].includes(dashboardTextCommand)) {
        await logBotInteraction({
          guild: message.guild!,
          eventKey: "interaction.text_dashboard.received",
          title: "Dashboard text request received",
          actorId: message.author.id,
          actorLabel: message.member?.displayName ?? message.author.username,
          details: buildInteractionLogDetails({ kind: "text_dashboard", channelId: message.channelId, command: "dashboard link", outcome: "received" }),
        });
        if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
          await message.reply({ content: "رابط لوحة التحكم متاح فقط لمن لديه صلاحية إدارة السيرفر.", allowedMentions: { repliedUser: false } });
          return;
        }
        const settings = await getGuildSettings(message.guild!.id);
        if (!settings?.dashboardUrl) {
          await message.reply({ content: "لم يتم ضبط رابط لوحة التحكم بعد. أضفه من صفحة الإشراف والحماية.", allowedMentions: { repliedUser: false } });
          return;
        }
        try {
          const url = new URL(settings.dashboardUrl);
          if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Unsupported protocol");
          const openButton = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("فتح لوحة التحكم").setEmoji("🛡️").setURL(url.toString());
          await message.reply({
            embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("لوحة التحكم").setDescription("استخدم الزر لفتح لوحة إدارة مجلساوي.").setTimestamp()],
            components: [new ActionRowBuilder<ButtonBuilder>().addComponents(openButton)],
            allowedMentions: { repliedUser: false },
          });
          await logBotInteraction({ guild: message.guild!, eventKey: "dashboard.link.shared", title: "Control-panel link shared", actorId: message.author.id, actorLabel: message.member?.displayName ?? message.author.username, details: buildInteractionLogDetails({ kind: "text_dashboard", channelId: message.channelId, command: "dashboard link", outcome: "completed" }) });
        } catch {
          await message.reply({ content: "رابط لوحة التحكم غير صالح. حدّثه من صفحة الإشراف والحماية.", allowedMentions: { repliedUser: false } });
        }
        return;
      }
      if (isBotMentioned) {
        const intent = classifyMentionIntent(message.content);
        await logBotInteraction({
          guild: message.guild!,
          eventKey: "interaction.mention.received",
          title: "Message directed to bot",
          actorId: message.author.id,
          actorLabel: message.member?.displayName ?? message.author.username,
          details: buildInteractionLogDetails({ kind: "mention", channelId: message.channelId, command: intent, outcome: "received", policy: intent === "blocked" ? "administrative_or_destructive" : intent === "voice_request" ? "safe_voice_only" : null }),
        });
        if (intent === "blocked") {
          await logBotInteraction({
            guild: message.guild!,
            eventKey: "ai.request.rejected",
            title: "AI request blocked by safety policy",
            actorId: message.author.id,
            actorLabel: message.member?.displayName ?? message.author.username,
            details: buildInteractionLogDetails({ kind: "mention", channelId: message.channelId, command: "AI request", outcome: "blocked", policy: "administrative_or_destructive" }),
          });
          await message.reply({ content: "لا أنفذ الحذف أو الطرد أو الحظر أو تعديل الرتب والقنوات. نطاقي الآمن يقتصر على الميوت والديفن والنقل الصوتي فقط.", allowedMentions: { repliedUser: false } });
          return;
        }
        if (intent === "voice_request") {
          await logBotInteraction({
            guild: message.guild!,
            eventKey: "ai.voice.request_detected",
            title: "AI voice request detected",
            actorId: message.author.id,
            actorLabel: message.member?.displayName ?? message.author.username,
            details: buildInteractionLogDetails({ kind: "mention", channelId: message.channelId, command: "safe voice request", outcome: "rejected", policy: "safe_voice_only" }),
          });
          await message.reply({ content: "أوامر الذكاء الآمنة تقتصر على الميوت والديفن والنقل الصوتي. لن أنفذ أي إجراء إداري أو مدمر عبر المحادثة.", allowedMentions: { repliedUser: false } });
        }
      }
      const xp = await adjustMemberXp({ guildId: message.guild!.id, memberId: message.author.id, memberLabel: message.member?.displayName ?? message.author.username, delta: 5 });
      if (!xp.levelChanged) return;
      await logDiscordEvent({ guild: message.guild!, category: "xp", eventKey: "xp.level_up", title: "Member levelled up", accentColor: "#00D4AA", icon: "✨", targetId: message.author.id, targetLabel: message.member?.displayName ?? message.author.username, details: { "Level": `${xp.level}`, "XP": `${xp.xp}` } });
    })();
  });

  client.on(Events.InteractionCreate, interaction => {
    void (async () => {
      if ((interaction.isChatInputCommand() || interaction.isButton()) && interaction.guild && await isBlacklistedMember(interaction.guild.id, interaction.user.id)) return;
      if (interaction.isChatInputCommand()) {
      if (interaction.guild) {
        void logBotInteraction({
          guild: interaction.guild,
          eventKey: "interaction.slash_command.received",
          title: "Bot slash command received",
          actorId: interaction.user.id,
          actorLabel: interaction.member && "displayName" in interaction.member ? interaction.member.displayName : interaction.user.username,
          details: buildInteractionLogDetails({ kind: "slash_command", channelId: interaction.channelId, command: `/${interaction.commandName}`, outcome: "received" }),
        });
      }
      if (interaction.commandName === "dashboard") void handleDashboardCommand(interaction);
      else if (interaction.commandName === "join" || interaction.commandName === "leave") void handleVoiceConnectionCommand(interaction);
      else if (interaction.commandName === "say") void handleSpeechCommand(interaction);
      else void handleModerationCommand(interaction);
    }
      if (interaction.isButton() && interaction.customId.startsWith("jail:release:")) {
        if (interaction.guild) {
        void logBotInteraction({
          guild: interaction.guild,
          eventKey: "interaction.jail_release_button.received",
          title: "Bot control button received",
          actorId: interaction.user.id,
          actorLabel: interaction.user.username,
          details: buildInteractionLogDetails({ kind: "button", channelId: interaction.channelId, command: "jail release", outcome: "received" }),
        });
        }
        void handleJailReleaseButton(interaction);
      }
    })();
  });

  client.once(Events.ClientReady, readyClient => {
    console.info(`[Discord] Gateway ready: ${readyClient.user.tag} | guilds=${readyClient.guilds.cache.size}`);
  });

  void client.login(process.env.DISCORD_BOT_TOKEN).catch(error => {
    console.error("[Discord] Bot login failed", error);
    started = false;
  });
}
