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
  type NonThreadGuildBasedChannel,
  type PermissionsBitField,
  TextChannel,
} from "discord.js";
import { entersState, getVoiceConnection, joinVoiceChannel, VoiceConnectionStatus } from "@discordjs/voice";
import { randomUUID } from "node:crypto";
import {
  adjustMemberXp,
  adjustEconomyBalance,
  adjustMemberReputation,
  countActiveWarnings,
  createCommunityEvent,
  closeCommunityEvent,
  createGiveaway,
  createPoll,
  createSuggestion,
  createSupportTicket,
  createTicketPanel,
  closeSupportTicket,
  closePoll,
  claimSupportTicket,
  createWarningRecord,
  createJailRecord,
  getActiveJailRecord,
  getActiveJailRecordById,
  getCommandRoleIds,
  getGuildSettings,
  getEconomyProfile,
  getRoleShopItemById,
  getSuggestionById,
  getTicketPanelById,
  getSupportTicketById,
  getSupportTicketByGuildId,
  isBlacklistedMember,
  enterGiveaway,
  finishGiveaway,
  getGiveawayById,
  getCommunityEventById,
  getEventRsvpSummary,
  getMemberLevel,
  getMemberXpProfile,
  getPollById,
  listAutoModRules,
  listActiveWarnings,
  listGiveawayEntries,
  listCommunityKnowledgeItems,
  listCommunityEvents,
  listEconomyTransactionHistory,
  listModerationCaseHistory,
  listLevelRoleRewards,
  listModerationCasesSince,
  listPollOptions,
  listPollResults,
  listRoleShopItems,
  listXpLeaderboard,
  parseJailRoles,
  recordModerationCase,
  releaseJailRecord,
  resolveWarningRecord,
  saveJailMessageId,
  saveWarningAppeal,
  saveGuildSettings,
  saveSuggestionMessageId,
  saveSupportTicketSummaryMetadata,
  setEventRsvp,
  updateSuggestionStatus,
  votePoll,
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
import { detectAutoModRule, detectLink, renderLevelUpMessage, updateWindow } from "./communityRules";
import { parseAdminAssistantRequest, type AdminAssistantProposal } from "./adminAssistantPolicy";
import { validateAdminAssistantConfirmation, validateBotAdminAssistantCapability } from "./adminAssistantExecution";
import { canUseLocalAssistant, draftComplaint, findKnowledgeAnswer, prepareTicketSummaryMetadata, suggestEventIdea, summarizeTicketMetadata } from "./communityAssistant";
import { assessPollVote } from "./pollRules";
import { assessPollClose, formatPollResults } from "./pollCloseRules";
import { assessGiveawayEntry } from "./giveawayRules";
import { assessEventRsvp } from "./eventRules";
import { assessEventClose, formatEventRsvpSummary } from "./eventCloseRules";
import { assessRoleShopPurchase, canUseEconomyAction } from "./economyRules";
import { buildModeratorActivityRows } from "./moderatorReport";
import { assessWelcomeAutoRole } from "./welcomeAutoRoleRules";
import { buildMemberCountChannelName, canUpdateMemberCounter } from "./memberCounterRules";
import { canPlayRps, resolveRps, rpsChoices, type RpsChoice } from "./rpsRules";
import { assessChannelLock } from "./channelLockRules";
import { canClaimSupportTicket, canCloseSupportTicket } from "./ticketRules";
import { assessManualCleanup } from "./cleanupRules";
import { canManageTicketCategory } from "./ticketCategoryRules";
import { resolveWarningExpiry } from "./warningRules";
import { planTicketMetadataSummary } from "./ticketSummaryRules";
import { executeTicketMetadataSummary } from "./ticketSummaryExecution";
import { formatXpLeaderboard } from "./xpLeaderboard";
import { formatXpProgress } from "./xpRankRules";
import { canApplyXpAdjustment, normalizeXpAdjustment } from "./xpAdjustmentRules";
import { formatActiveWarnings } from "./warningSummary";
import { assessAnnouncementDelivery } from "./announcementRules";
import { assessSuggestionStatusUpdate } from "./suggestionStatusRules";
import { assessTriviaAnswer, selectTriviaQuestion, type PendingTrivia } from "./triviaRules";

let client: Client | null = null;
let started = false;
let startedAt: Date | null = null;

type PendingAdminAction = { proposal: Exclude<AdminAssistantProposal, { kind: "refuse" }>; guildId: string; actorId: string; expiresAt: number };
const pendingAdminActions = new Map<string, PendingAdminAction>();
const localAssistantUseTimes = new Map<string, number>();
const economyActionUseTimes = new Map<string, number>();
const rpsUseTimes = new Map<string, number>();
const triviaStartTimes = new Map<string, number>();
const pendingTriviaRounds = new Map<string, PendingTrivia>();

export const communityCommandNames = new Set([
  "suggest", "announce", "poll", "pollend", "event", "eventend", "events", "giveaway", "giveawayend", "ticketpanel",
  "balance", "memberinfo", "rank", "xprewards", "creditslog", "pay", "rep", "shop", "buyrole", "credits", "modreport",
  "modcases", "rps", "trivia", "lock", "unlock", "clean", "xptop", "warnings", "unwarn", "appealwarning", "help",
  "faq", "complaint", "eventidea", "ticketsummary", "adminassist",
]);

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

async function syncMemberCounter(guild: Guild, memberCountChannelId?: string | null) {
  if (!memberCountChannelId) return;
  const channel = await guild.channels.fetch(memberCountChannelId).catch(() => null);
  if (!canUpdateMemberCounter({ channelExists: Boolean(channel), channelManageable: Boolean(channel?.manageable) })) return;
  await channel!.setName(buildMemberCountChannelName(guild.memberCount), "مجلساوي member counter update").catch(() => undefined);
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
      .addIntegerOption(option => option.setName("amount").setDescription("Positive to add, negative to remove").setRequired(true).setMinValue(-1_000_000).setMaxValue(1_000_000))
      .toJSON(),
    new SlashCommandBuilder().setName("xptop").setDescription("View this server's XP leaderboard"),
    new SlashCommandBuilder().setName("xprewards").setDescription("View configured level role rewards for this server"),
    new SlashCommandBuilder().setName("creditslog").setDescription("View your recent community credit activity").addIntegerOption(option => option.setName("limit").setDescription("Entries to show, 1–15").setMinValue(1).setMaxValue(15)),
    new SlashCommandBuilder().setName("events").setDescription("View recent community events for this server"),
    new SlashCommandBuilder().setName("warnings").setDescription("View active warnings for a member").setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption(option => option.setName("member").setDescription("Member to review").setRequired(true)),
    new SlashCommandBuilder().setName("unwarn").setDescription("Resolve one active warning for a member").setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption(option => option.setName("member").setDescription("Member whose warning will be resolved").setRequired(true)).addIntegerOption(option => option.setName("id").setDescription("Active warning ID from /warnings").setRequired(true).setMinValue(1)),
    new SlashCommandBuilder().setName("appealwarning").setDescription("Submit a private note for one of your warnings").addIntegerOption(option => option.setName("id").setDescription("Warning ID").setRequired(true).setMinValue(1)).addStringOption(option => option.setName("note").setDescription("Short appeal note").setRequired(true).setMaxLength(600)),
    new SlashCommandBuilder().setName("modcases").setDescription("View recent sanitized moderation cases").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).addIntegerOption(option => option.setName("limit").setDescription("Cases to show, 1–20").setMinValue(1).setMaxValue(20)),
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
    new SlashCommandBuilder().setName("suggest").setDescription("Send a community suggestion").addStringOption(option => option.setName("text").setDescription("Suggestion text").setRequired(true).setMaxLength(1800)).addBooleanOption(option => option.setName("anonymous").setDescription("Post anonymously")).toJSON(),
    new SlashCommandBuilder().setName("announce").setDescription("Send a formatted community announcement").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).addChannelOption(option => option.setName("channel").setDescription("Destination text channel").setRequired(true).addChannelTypes(ChannelType.GuildText)).addStringOption(option => option.setName("title").setDescription("Announcement title").setRequired(true).setMaxLength(128)).addStringOption(option => option.setName("message").setDescription("Announcement details").setRequired(true).setMaxLength(2000)).addRoleOption(option => option.setName("role").setDescription("Optional role to mention")),
    new SlashCommandBuilder().setName("poll").setDescription("Create a poll").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).addStringOption(option => option.setName("question").setDescription("Poll question").setRequired(true).setMaxLength(256)).addStringOption(option => option.setName("options").setDescription("Choices separated by | ").setRequired(true).setMaxLength(800)).addBooleanOption(option => option.setName("anonymous").setDescription("Anonymous voting")),
    new SlashCommandBuilder().setName("pollend").setDescription("Close an active poll and show its results").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).addIntegerOption(option => option.setName("id").setDescription("Poll ID").setRequired(true).setMinValue(1)),
    new SlashCommandBuilder().setName("event").setDescription("Create a community event").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).addStringOption(option => option.setName("title").setDescription("Event title").setRequired(true).setMaxLength(160)).addStringOption(option => option.setName("description").setDescription("Event details").setRequired(true).setMaxLength(2000)).addIntegerOption(option => option.setName("minutes").setDescription("Minutes until start").setRequired(true).setMinValue(1).setMaxValue(525600)),
    new SlashCommandBuilder().setName("eventend").setDescription("Complete a scheduled event and show RSVP totals").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).addIntegerOption(option => option.setName("id").setDescription("Event ID").setRequired(true).setMinValue(1)),
    new SlashCommandBuilder().setName("giveaway").setDescription("Create a giveaway").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).addStringOption(option => option.setName("prize").setDescription("Prize").setRequired(true).setMaxLength(256)).addIntegerOption(option => option.setName("minutes").setDescription("Minutes until end").setRequired(true).setMinValue(1).setMaxValue(10080)).addIntegerOption(option => option.setName("winners").setDescription("Winner count").setRequired(true).setMinValue(1).setMaxValue(20)),
    new SlashCommandBuilder().setName("giveawayend").setDescription("End an active giveaway and select winners").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).addIntegerOption(option => option.setName("id").setDescription("Giveaway ID").setRequired(true)),
    new SlashCommandBuilder().setName("ticketpanel").setDescription("Post a support-ticket panel").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).addRoleOption(option => option.setName("staff_role").setDescription("Staff role").setRequired(true)).addStringOption(option => option.setName("title").setDescription("Panel title").setRequired(true).setMaxLength(128)).addStringOption(option => option.setName("description").setDescription("Panel description").setRequired(true).setMaxLength(1000)),
    new SlashCommandBuilder().setName("balance").setDescription("View your community balance and reputation").addUserOption(option => option.setName("member").setDescription("Optional member")),
    new SlashCommandBuilder().setName("memberinfo").setDescription("View a member's community profile").addUserOption(option => option.setName("member").setDescription("Optional member")),
    new SlashCommandBuilder().setName("rank").setDescription("View your XP rank progress in this server"),
    new SlashCommandBuilder().setName("pay").setDescription("Transfer virtual community credits").addUserOption(option => option.setName("member").setDescription("Recipient").setRequired(true)).addIntegerOption(option => option.setName("amount").setDescription("Amount").setRequired(true).setMinValue(1).setMaxValue(100000)),
    new SlashCommandBuilder().setName("rep").setDescription("Give a member one reputation point").addUserOption(option => option.setName("member").setDescription("Member").setRequired(true)),
    new SlashCommandBuilder().setName("shop").setDescription("View available community role shop items"),
    new SlashCommandBuilder().setName("buyrole").setDescription("Buy a configured community role").addIntegerOption(option => option.setName("id").setDescription("Shop item ID").setRequired(true).setMinValue(1)),
    new SlashCommandBuilder().setName("credits").setDescription("Grant or remove community credits").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).addUserOption(option => option.setName("member").setDescription("Member").setRequired(true)).addIntegerOption(option => option.setName("amount").setDescription("Positive grants, negative removes").setRequired(true).setMinValue(-100000).setMaxValue(100000)).addStringOption(option => option.setName("reason").setDescription("Admin note").setMaxLength(160)),
    new SlashCommandBuilder().setName("modreport").setDescription("View moderator activity for a recent period").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).addIntegerOption(option => option.setName("hours").setDescription("Hours to include, 1–168").setMinValue(1).setMaxValue(168)),
    new SlashCommandBuilder().setName("rps").setDescription("Play a quick rock paper scissors round").addStringOption(option => option.setName("choice").setDescription("Your choice").setRequired(true).addChoices({ name: "Rock / حجر", value: "rock" }, { name: "Paper / ورق", value: "paper" }, { name: "Scissors / مقص", value: "scissors" })),
    new SlashCommandBuilder().setName("trivia").setDescription("Start a short private-answer trivia round"),
    new SlashCommandBuilder().setName("lock").setDescription("Lock a manageable text channel").setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels).addChannelOption(option => option.setName("channel").setDescription("Text channel, defaults to the current channel").addChannelTypes(ChannelType.GuildText)),
    new SlashCommandBuilder().setName("unlock").setDescription("Unlock a manageable text channel").setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels).addChannelOption(option => option.setName("channel").setDescription("Text channel, defaults to the current channel").addChannelTypes(ChannelType.GuildText)),
    new SlashCommandBuilder().setName("clean").setDescription("Delete a bounded number of recent messages").setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages).addIntegerOption(option => option.setName("count").setDescription("Messages to delete, 1–100").setRequired(true).setMinValue(1).setMaxValue(100)).addChannelOption(option => option.setName("channel").setDescription("Text channel, defaults to the current channel").addChannelTypes(ChannelType.GuildText)),
    new SlashCommandBuilder().setName("help").setDescription("Search approved server rules and FAQs").addStringOption(option => option.setName("question").setDescription("Question about the community").setRequired(true).setMaxLength(500)),
    new SlashCommandBuilder().setName("faq").setDescription("Search approved community FAQs").addStringOption(option => option.setName("question").setDescription("FAQ question").setRequired(true).setMaxLength(500)),
    new SlashCommandBuilder().setName("complaint").setDescription("Create a private complaint template").addStringOption(option => option.setName("subject").setDescription("Complaint title").setRequired(true).setMaxLength(160)).addStringOption(option => option.setName("details").setDescription("Relevant details").setRequired(true).setMaxLength(1400)),
    new SlashCommandBuilder().setName("eventidea").setDescription("Get a safe local event idea").addStringOption(option => option.setName("topic").setDescription("Optional topic").setMaxLength(120)),
    new SlashCommandBuilder().setName("ticketsummary").setDescription("Create a metadata-only ticket summary").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).addIntegerOption(option => option.setName("id").setDescription("Ticket ID").setRequired(true).setMinValue(1)).addStringOption(option => option.setName("metadata").setDescription("Staff-provided metadata only; no transcript").setMaxLength(1800)),
    new SlashCommandBuilder().setName("adminassist").setDescription("Preview a safe channel, role, or jail-role request before confirmation").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).addStringOption(option => option.setName("request").setDescription("Example: أنشئ رتبة اسمها تالف خاصة بالسجن مايشوف الا روم ss").setRequired(true).setMaxLength(300)),
  ];
}

export async function handleCommunityCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.channel?.isTextBased()) return;
  const command = interaction.commandName;
  const restricted = ["poll", "event", "giveaway", "giveawayend", "ticketpanel"].includes(command);
  if (restricted && !await canUseModerationAction(interaction.guild, interaction.user.id, command === "ticketpanel" ? "ticket" : command as ModerationCommandKey, PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: "ليس لديك صلاحية أو رتبة هذا النظام.", ephemeral: true }); return;
  }
  try {
    if (command === "adminassist") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: "هذا المساعد متاح لمن يملك Manage Server فقط.", ephemeral: true });
        return;
      }
      const proposal = parseAdminAssistantRequest(interaction.options.getString("request", true));
      if (proposal.kind === "refuse") {
        await logDiscordEvent({ guild: interaction.guild, category: "system", eventKey: "admin_assistant.refused", title: "Safe admin assistant request refused", accentColor: "#ED4245", icon: "🛡️", actorId: interaction.user.id, actorLabel: interaction.user.username, details: { "Outcome": proposal.reason, "Request text": "Not retained" } });
        await interaction.reply({ content: proposal.reason, ephemeral: true });
        return;
      }
      const nonce = randomUUID();
      pendingAdminActions.set(nonce, { proposal, guildId: interaction.guild.id, actorId: interaction.user.id, expiresAt: Date.now() + 5 * 60_000 });
      const detail = proposal.kind === "create_channel"
        ? `إنشاء روم نصي **#${proposal.name}** · ${proposal.visibility === "private" ? "خاص (مخفي عن @everyone)" : "عام"}`
        : proposal.kind === "create_role"
          ? `إنشاء رتبة **${proposal.name}** بدون أي صلاحيات إدارية أو Administrator`
          : proposal.kind === "create_jail_role"
            ? `إنشاء رتبة سجن **${proposal.roleName}** بلا صلاحيات إدارية، وربطها بسجن نصي واحد **#${proposal.allowedChannelName}**. أعضاء هذه الرتبة لن يروا أو يتكلموا في الرومات الأخرى.`
            : `تغيير ظهور روم **#${proposal.channelName}** إلى ${proposal.visibility === "private" ? "خاص" : "عام"}`;
      const confirm = new ButtonBuilder().setCustomId(`adminassist:confirm:${nonce}`).setStyle(ButtonStyle.Success).setLabel("تأكيد آمن");
      const cancel = new ButtonBuilder().setCustomId(`adminassist:cancel:${nonce}`).setStyle(ButtonStyle.Secondary).setLabel("إلغاء");
      await interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder().setColor(0x5865f2).setAuthor({ name: "🛡️ مجلساوي • SAFE ADMIN ASSISTANT" }).setTitle("راجع التغيير قبل تنفيذه").setDescription(detail).addFields({ name: "قيود دائمة", value: "لا حذف، لا Administrator، لا Webhooks أو Integrations، ولا تعديل صلاحيات لأعضاء أو رتب موجودة. خطة السجن تضبط رتبة جديدة فقط." }).setFooter({ text: "تنتهي هذه المعاينة خلال 5 دقائق" })], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(confirm, cancel)] });
      return;
    }
    if (["help", "faq", "complaint", "eventidea"].includes(command)) {
      const settings = await getGuildSettings(interaction.guild.id);
      if (!settings?.aiEnabled) { await interaction.reply({ content: "مساعد المجتمع المحلي غير مفعّل من لوحة التحكم.", ephemeral: true }); return; }
      const assistantKey = `${interaction.guild.id}:${interaction.user.id}`;
      const lastUsedAt = localAssistantUseTimes.get(assistantKey);
      if (!canUseLocalAssistant(lastUsedAt, Date.now())) { await interaction.reply({ content: "انتظر خمس ثوانٍ قبل استخدام مساعد المجتمع مرة أخرى.", ephemeral: true }); return; }
      localAssistantUseTimes.set(assistantKey, Date.now());
      if (command === "complaint") {
        const draft = draftComplaint({ subject: interaction.options.getString("subject", true), details: interaction.options.getString("details", true), memberMention: `<@${interaction.user.id}>` });
        await interaction.reply({ content: draft, ephemeral: true, allowedMentions: { users: [interaction.user.id] } });
      } else if (command === "eventidea") {
        await interaction.reply({ content: suggestEventIdea(interaction.options.getString("topic") ?? ""), ephemeral: true });
      } else {
        const knowledge = await listCommunityKnowledgeItems(interaction.guild.id);
        const answer = findKnowledgeAnswer(interaction.options.getString("question", true), knowledge.filter(item => command === "faq" ? item.kind === "faq" : true));
        await interaction.reply({ content: answer, ephemeral: true });
      }
      await logDiscordEvent({ guild: interaction.guild, category: "ai", eventKey: `community_assistant.${command}`, title: "Local community assistant used", accentColor: "#5865F2", icon: "🧠", actorId: interaction.user.id, actorLabel: interaction.user.username, details: { "Mode": "Local templates and approved knowledge only", "Input": "Not retained" } });
      return;
    }
    if (command === "ticketsummary") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) { await interaction.reply({ content: "هذا الملخص متاح لإدارة السيرفر فقط.", ephemeral: true }); return; }
      const ticketId = interaction.options.getInteger("id", true);
      const execution = await executeTicketMetadataSummary({ ticketId, guildId: interaction.guild.id, suppliedMetadata: interaction.options.getString("metadata"), getTicket: getSupportTicketByGuildId, saveMetadata: saveSupportTicketSummaryMetadata });
      if (!execution.allowed) throw new Error(execution.reason === "not_found" ? "لم أجد تذكرة بهذا الرقم." : "لم أجد تذكرة لهذا السيرفر بهذا الرقم.");
      const summaryTicket = execution.ticket;
      await interaction.reply({ content: summarizeTicketMetadata(summaryTicket), ephemeral: true, allowedMentions: { users: [summaryTicket.claimedById, summaryTicket.closedById].filter((id): id is string => Boolean(id)) } });
      await logDiscordEvent({ guild: interaction.guild, category: "ai", eventKey: "community_assistant.ticket_metadata_summary", title: "Local ticket metadata summary generated", accentColor: "#5865F2", icon: "🧠", actorId: interaction.user.id, actorLabel: interaction.user.username, targetId: String(summaryTicket.id), targetLabel: `Ticket #${summaryTicket.id}`, details: { "Scope": "Metadata only", "Ticket content": "Not read or retained" } });
      return;
    }
    if (command === "xptop") {
      const leaderboard = await listXpLeaderboard(interaction.guild.id);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setAuthor({ name: "✨ مجلساوي • XP LEADERBOARD" }).setTitle("صدارة XP").setDescription(formatXpLeaderboard(leaderboard)).setFooter({ text: "أعلى 10 في هذا السيرفر فقط" }).setTimestamp()], allowedMentions: { parse: [] } });
      return;
    }
    if (command === "xprewards") {
      const rewards = (await listLevelRoleRewards(interaction.guild.id)).sort((left, right) => left.level - right.level || left.id - right.id).slice(0, 25);
      const description = rewards.length ? rewards.map(item => `المستوى **${item.level}** → <@&${item.roleId}>`).join("\n") : "لا توجد رتب مكافآت XP مهيأة حالياً.";
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00D4AA).setAuthor({ name: "✨ مجلساوي • XP REWARDS" }).setTitle("رتب مكافآت المستويات").setDescription(description).setFooter({ text: "إعدادات هذا السيرفر فقط • لا يتم إرسال منشن" }).setTimestamp()], allowedMentions: { parse: [] } });
      return;
    }
    if (command === "creditslog") {
      const limit = Math.min(15, Math.max(1, interaction.options.getInteger("limit") ?? 10));
      const transactions = await listEconomyTransactionHistory({ guildId: interaction.guild.id, memberId: interaction.user.id, limit });
      const lines = transactions.map((item, index) => `**${index + 1}.** ${item.amount > 0 ? "+" : ""}${item.amount} · ${item.kind} · <t:${Math.floor(item.createdAt.getTime() / 1000)}:R>`);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFEE75C).setAuthor({ name: "💰 مجلساوي • CREDIT HISTORY" }).setTitle("سجل رصيدك").setDescription(lines.length ? lines.join("\n") : "لا توجد عمليات رصيد مسجلة لك بعد.").setFooter({ text: "خاص بك وضمن هذا السيرفر فقط • لا يعرض أسباب أو ملاحظات العمليات" }).setTimestamp()], ephemeral: true, allowedMentions: { parse: [] } });
      return;
    }
    if (command === "events") {
      const events = (await listCommunityEvents(interaction.guild.id)).slice(0, 10);
      const lines = events.map(event => `**${event.title}** · ${event.status} · <t:${Math.floor(event.startsAt.getTime() / 1000)}:R>`);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setAuthor({ name: "📅 مجلساوي • EVENTS" }).setTitle("فعاليات المجتمع").setDescription(lines.length ? lines.join("\n") : "لا توجد فعاليات مسجلة حالياً.").setFooter({ text: "هذا السيرفر فقط • لا يعرض أسماء المشاركين أو تذكيرات تلقائية" }).setTimestamp()], allowedMentions: { parse: [] } });
      return;
    }
    if (command === "rank") {
      const profile = await getMemberXpProfile(interaction.guild.id, interaction.user.id);
      const progress = formatXpProgress(profile.xp, profile.level);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00D4AA).setAuthor({ name: "✨ مجلساوي • XP RANK" }).setTitle("تقدمك في هذا السيرفر").setDescription(`${progress.bar} **${progress.percent}%**`).addFields({ name: "المستوى", value: `**${profile.level}**`, inline: true }, { name: "إجمالي XP", value: `**${profile.xp.toLocaleString("en-US")}**`, inline: true }, { name: "المستوى التالي", value: `${progress.nextFloor.toLocaleString("en-US")} XP`, inline: true }).setFooter({ text: "بيانات XP خاصة بهذا السيرفر فقط" }).setTimestamp()], allowedMentions: { parse: [] } });
      return;
    }
    if (command === "memberinfo") {
      const user = interaction.options.getUser("member") ?? interaction.user;
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) throw new Error("هذا الحساب ليس عضواً متاحاً في هذا السيرفر.");
      const [level, economy] = await Promise.all([getMemberLevel(interaction.guild.id, member.id), getEconomyProfile(interaction.guild.id, member.id)]);
      const joined = member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : "غير معروف";
      const accountCreated = `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`;
      const roleCount = Math.max(0, member.roles.cache.size - 1);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(member.displayHexColor === "#000000" ? 0x5865F2 : member.displayColor).setAuthor({ name: "👤 مجلساوي • MEMBER PROFILE" }).setTitle(member.displayName).setThumbnail(user.displayAvatarURL()).addFields({ name: "المستوى", value: `**${level}**`, inline: true }, { name: "الرصيد", value: `**${economy.balance.toLocaleString("en-US")}**`, inline: true }, { name: "السمعة", value: `**${economy.reputation.toLocaleString("en-US")}**`, inline: true }, { name: "رتب السيرفر", value: `${roleCount}`, inline: true }, { name: "انضم للسيرفر", value: joined, inline: true }, { name: "تاريخ الحساب", value: accountCreated, inline: true }).setFooter({ text: "البيانات من هذا السيرفر فقط" }).setTimestamp()], allowedMentions: { parse: [] } });
      return;
    }
    if (command === "warnings") {
      const allowed = await canUseModerationAction(interaction.guild, interaction.user.id, "warn", PermissionFlagsBits.ModerateMembers);
      if (!allowed) { await interaction.reply({ content: "ليس لديك صلاحية أو رتبة عرض التحذيرات.", ephemeral: true }); return; }
      const member = interaction.options.getUser("member", true);
      const warnings = await listActiveWarnings({ guildId: interaction.guild.id, memberId: member.id });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFEE75C).setAuthor({ name: "⚠️ مجلساوي • ACTIVE WARNINGS" }).setTitle(`تحذيرات ${member.username}`).setDescription(formatActiveWarnings(warnings)).setFooter({ text: "للمشرفين فقط • التحذيرات المنتهية لا تظهر" }).setTimestamp()], ephemeral: true, allowedMentions: { parse: [] } });
      return;
    }
    if (command === "unwarn") {
      const allowed = await canUseModerationAction(interaction.guild, interaction.user.id, "warn", PermissionFlagsBits.ModerateMembers);
      if (!allowed) { await interaction.reply({ content: "ليس لديك صلاحية أو رتبة حل التحذيرات.", ephemeral: true }); return; }
      const member = interaction.options.getUser("member", true);
      const warningId = interaction.options.getInteger("id", true);
      const resolved = await resolveWarningRecord({ guildId: interaction.guild.id, memberId: member.id, id: warningId });
      if (!resolved) { await interaction.reply({ content: "لم أجد تحذيراً نشطاً بهذا الرقم لهذا العضو داخل هذا السيرفر.", ephemeral: true }); return; }
      await interaction.reply({ content: `تم حل التحذير #${warningId} للعضو <@${member.id}>.`, ephemeral: true, allowedMentions: { users: [member.id] } });
      await logDiscordEvent({ guild: interaction.guild, category: "moderation", eventKey: "warning.resolved", title: "Warning resolved", accentColor: "#57F287", icon: "✅", actorId: interaction.user.id, actorLabel: interaction.user.username, targetId: member.id, targetLabel: member.username, details: { "Warning ID": `${warningId}`, "Reason": "Not repeated in log" } });
      return;
    }
    if (command === "appealwarning") {
      const warningId = interaction.options.getInteger("id", true);
      const note = interaction.options.getString("note", true).trim();
      if (!note) { await interaction.reply({ content: "اكتب ملاحظة مختصرة للطعن.", ephemeral: true, allowedMentions: { parse: [] } }); return; }
      const saved = await saveWarningAppeal({ guildId: interaction.guild.id, memberId: interaction.user.id, id: warningId, note });
      await interaction.reply({ content: saved ? "تم إرسال ملاحظتك للمراجعة بشكل خاص." : "لا يمكن إرسال طعن لهذا التحذير. يجب أن يكون تحذيراً محلولاً ضمن سجلك في هذا السيرفر ولم يُرسل له طعن سابق.", ephemeral: true, allowedMentions: { parse: [] } });
      return;
    }
    if (command === "modcases") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) { await interaction.reply({ content: "هذا السجل لإدارة السيرفر فقط.", ephemeral: true }); return; }
      const requestedLimit = interaction.options.getInteger("limit") ?? 10;
      const limit = Math.min(20, Math.max(1, requestedLimit));
      const cases = await listModerationCaseHistory({ guildId: interaction.guild.id, limit });
      const lines = cases.map((item, index) => `**${index + 1}.** ${item.action} · ${item.executorLabel} → ${item.memberLabel} · <t:${Math.floor(item.createdAt.getTime() / 1000)}:R>`);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setAuthor({ name: "🛡️ مجلساوي • MODERATION HISTORY" }).setTitle("أحدث حالات الإشراف").setDescription(lines.length ? lines.join("\n") : "لا توجد حالات إشراف مسجلة بعد.").setFooter({ text: "السجل من هذا السيرفر فقط • لا يعرض الأسباب أو محتوى الرسائل" }).setTimestamp()], ephemeral: true, allowedMentions: { parse: [] } });
      return;
    }
    if (command === "announce") {
      const authorized = await canUseModerationAction(interaction.guild, interaction.user.id, "community_manage", PermissionFlagsBits.ManageGuild);
      const selected = interaction.options.getChannel("channel", true);
      const channel = selected?.type === ChannelType.GuildText ? selected as TextChannel : null;
      const role = interaction.options.getRole("role");
      const botMember = interaction.guild.members.me;
      const permissions = channel && botMember ? channel.permissionsFor(botMember) : null;
      const plan = assessAnnouncementDelivery({ authorized, isTextChannel: Boolean(channel), botCanSend: Boolean(permissions?.has(PermissionFlagsBits.SendMessages)), botCanEmbed: Boolean(permissions?.has(PermissionFlagsBits.EmbedLinks)), requestedRoleId: role?.id, roleMentionable: role?.mentionable, botCanMentionRoles: Boolean(permissions?.has(PermissionFlagsBits.MentionEveryone)) });
      if (!plan.allowed) {
        const message = plan.reason === "unauthorized" ? "ليس لديك صلاحية أو رتبة نشر الإعلانات." : plan.reason === "not_text_channel" ? "اختر قناة نصية فقط." : plan.reason === "role_not_mentionable" ? "هذه الرتبة غير قابلة للذكر ومجلساوي لا يملك صلاحية ذكرها." : "مجلساوي يحتاج Send Messages وEmbed Links في القناة المحددة.";
        await interaction.reply({ content: message, ephemeral: true }); return;
      }
      const title = interaction.options.getString("title", true);
      const message = interaction.options.getString("message", true);
      await channel!.send({ content: plan.roleMentionId ? `<@&${plan.roleMentionId}>` : undefined, embeds: [new EmbedBuilder().setColor(0x5865F2).setAuthor({ name: "📣 مجلساوي • ANNOUNCEMENT" }).setTitle(title).setDescription(message).setFooter({ text: "إعلان مجتمع" }).setTimestamp()], allowedMentions: { roles: plan.roleMentionId ? [plan.roleMentionId] : [], parse: [] } });
      await interaction.reply({ content: `تم نشر الإعلان في ${channel}.`, ephemeral: true });
      await logDiscordEvent({ guild: interaction.guild, category: "community", eventKey: "announcement.sent", title: "Community announcement sent", accentColor: "#5865F2", icon: "📣", actorId: interaction.user.id, actorLabel: interaction.user.username, targetId: channel!.id, targetLabel: channel!.name, details: { "Role mention": plan.roleMentionId ? "Allowed role only" : "None", "Title": "Not retained in audit log body", "Message": "Not retained in audit log body" } });
      return;
    }
    if (command === "clean") {
      const selected = interaction.options.getChannel("channel") ?? interaction.channel;
      const channel = selected instanceof TextChannel ? selected : null;
      const botCanManageMessages = Boolean(channel && interaction.guild.members.me && channel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.ManageMessages));
      const count = interaction.options.getInteger("count", true);
      const plan = assessManualCleanup({ requesterCanManageMessages: Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)), isTextChannel: Boolean(channel), botCanManageMessages, count });
      if (!plan.allowed) {
        const message = plan.reason === "requester_forbidden" ? "تحتاج صلاحية Manage Messages للتنظيف." : plan.reason === "bot_forbidden" ? "مجلساوي يحتاج صلاحية Manage Messages في هذه القناة." : plan.reason === "invalid_count" ? "العدد يجب أن يكون بين 1 و100." : "اختر قناة نصية فقط.";
        throw new Error(message);
      }
      await interaction.deferReply({ ephemeral: true });
      const removed = await channel!.bulkDelete(count, true);
      await interaction.editReply(`تم حذف **${removed.size}** رسالة حديثة. الرسائل الأقدم من 14 يوماً لا يحذفها Discord دفعة واحدة.`);
      await logDiscordEvent({ guild: interaction.guild, category: "moderation", eventKey: "channel.manual_cleanup", title: "Manual channel cleanup", accentColor: "#FEE75C", icon: "🧹", actorId: interaction.user.id, actorLabel: interaction.user.username, targetId: channel!.id, targetLabel: channel!.name, details: { "Requested": `${count}`, "Deleted": `${removed.size}`, "Content": "Not retained in log" } });
      return;
    }
    if (command === "lock" || command === "unlock") {
      const selected = interaction.options.getChannel("channel") ?? interaction.channel;
      const channel = selected instanceof TextChannel ? selected : null;
      const plan = assessChannelLock({ requesterCanManageChannels: Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)), isTextChannel: Boolean(channel), botCanManageChannel: Boolean(channel?.manageable) });
      if (!plan.allowed) {
        const message = plan.reason === "requester_forbidden" ? "تحتاج صلاحية Manage Channels لقفل القنوات." : plan.reason === "not_text_channel" ? "اختر قناة نصية فقط." : "لا يستطيع مجلساوي إدارة هذه القناة؛ راجع ترتيب الرتب وصلاحياته.";
        throw new Error(message);
      }
      const locked = command === "lock";
      await channel!.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: locked ? false : null });
      await interaction.reply({ content: locked ? `تم قفل ${channel} للأعضاء.` : `تم فك قفل ${channel}.` });
      await logDiscordEvent({ guild: interaction.guild, category: "moderation", eventKey: locked ? "channel.locked" : "channel.unlocked", title: locked ? "Text channel locked" : "Text channel unlocked", accentColor: locked ? "#ED4245" : "#57F287", icon: locked ? "🔒" : "🔓", actorId: interaction.user.id, actorLabel: interaction.user.username, targetId: channel!.id, targetLabel: channel!.name, details: { "Permission changed": "@everyone Send Messages" } });
      return;
    }
    if (command === "rps") {
      const cooldownKey = `${interaction.guild.id}:${interaction.user.id}`;
      if (!canPlayRps(rpsUseTimes.get(cooldownKey), Date.now())) throw new Error("انتظر 30 ثانية قبل جولة جديدة.");
      const player = interaction.options.getString("choice", true) as RpsChoice;
      const botChoice = rpsChoices[Math.floor(Math.random() * rpsChoices.length)] as RpsChoice;
      const outcome = resolveRps(player, botChoice);
      rpsUseTimes.set(cooldownKey, Date.now());
      const labels: Record<RpsChoice, string> = { rock: "حجر", paper: "ورق", scissors: "مقص" };
      const outcomeText = outcome === "win" ? "فزت بالجولة!" : outcome === "lose" ? "فاز مجلساوي هذه المرة." : "تعادل.";
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(outcome === "win" ? 0x57F287 : outcome === "lose" ? 0xED4245 : 0xFEE75C).setAuthor({ name: "🎮 مجلساوي • RPS" }).setDescription(`**اختيارك:** ${labels[player]}\n**اختيار مجلساوي:** ${labels[botChoice]}\n\n${outcomeText}\n> هذه لعبة ترفيهية بلا رصيد أو رهانات.`).setTimestamp()] });
      await logBotInteraction({ guild: interaction.guild, eventKey: "community.rps", title: "Community RPS played", actorId: interaction.user.id, actorLabel: interaction.user.username, details: { "Outcome": outcome } });
      return;
    }
    if (command === "trivia") {
      const cooldownKey = `${interaction.guild.id}:${interaction.user.id}`;
      const now = Date.now();
      const remaining = 30_000 - (now - (triviaStartTimes.get(cooldownKey) ?? 0));
      if (remaining > 0) { await interaction.reply({ content: `انتظر ${Math.ceil(remaining / 1000)} ثانية قبل جولة Trivia جديدة.`, ephemeral: true }); return; }
      const question = selectTriviaQuestion(`${cooldownKey}:${Math.floor(now / 30_000)}`);
      const nonce = randomUUID().replaceAll("-", "").slice(0, 16);
      pendingTriviaRounds.set(nonce, { guildId: interaction.guild.id, actorId: interaction.user.id, question, expiresAt: now + 60_000 });
      triviaStartTimes.set(cooldownKey, now);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(question.options.map((option, index) => new ButtonBuilder().setCustomId(`trivia:answer:${nonce}:${index}`).setStyle(ButtonStyle.Secondary).setLabel(`${index + 1}. ${option}`.slice(0, 80))));
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x9B59B6).setAuthor({ name: "🧠 مجلساوي • TRIVIA" }).setTitle("سؤال سريع").setDescription(question.prompt).setFooter({ text: "هذه الجولة لك فقط وتنتهي خلال دقيقة • بلا جوائز أو رهانات" }).setTimestamp()], components: [row] });
      await logDiscordEvent({ guild: interaction.guild, category: "community", eventKey: "trivia.started", title: "Trivia round started", accentColor: "#9B59B6", icon: "🧠", actorId: interaction.user.id, actorLabel: interaction.user.username, details: { "Question": question.id, "Game": "No rewards or wagering" } });
      return;
    }
    if (command === "modreport") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) { await interaction.reply({ content: "هذا التقرير لإدارة السيرفر فقط.", ephemeral: true }); return; }
      const requestedHours = interaction.options.getInteger("hours") ?? 24;
      const hours = Math.min(168, Math.max(1, requestedHours));
      const cases = await listModerationCasesSince(interaction.guild.id, new Date(Date.now() - hours * 60 * 60_000));
      const rows = buildModeratorActivityRows(cases);
      const lines = rows.map(row => `<@${row.id}> — **${row.total}** (${row.actions.map(([action, total]) => `${action}:${total}`).join("، ")})`);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setAuthor({ name: "📊 مجلساوي • MODERATOR ACTIVITY" }).setTitle(`تقرير آخر ${hours} ساعة`).setDescription(lines.length ? lines.join("\n") : "لا توجد إجراءات إشراف مسجلة في هذه الفترة.").setFooter({ text: `إجمالي الإجراءات: ${cases.length} • لا يعرض التقرير أسباب الحالات أو محتوى الرسائل` }).setTimestamp()], ephemeral: true, allowedMentions: { users: rows.map(row => row.id) } });
      return;
    }
    if (command === "credits") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) { await interaction.reply({ content: "هذا الأمر لإدارة السيرفر فقط.", ephemeral: true }); return; }
      const target = interaction.options.getUser("member", true); const amount = interaction.options.getInteger("amount", true);
      if (!amount || target.bot) throw new Error("اختر عضواً غير بوت ومقداراً غير صفر.");
      const balance = await adjustEconomyBalance({ guildId: interaction.guild.id, memberId: target.id, amount, kind: "admin", reason: interaction.options.getString("reason")?.trim() || "Admin credit adjustment", counterpartyId: interaction.user.id });
      await interaction.reply({ content: `تم ${amount > 0 ? "إضافة" : "سحب"} **${Math.abs(amount)}** رصيد لـ <@${target.id}>. الرصيد الحالي: **${balance}**.`, allowedMentions: { users: [target.id] } });
      await logDiscordEvent({ guild: interaction.guild, category: "economy", eventKey: "economy.admin_credit", title: "Admin community credit adjustment", accentColor: "#FEE75C", icon: "💰", actorId: interaction.user.id, actorLabel: interaction.user.username, targetId: target.id, targetLabel: target.username, details: { "Amount": `${amount}`, "Reason": "Admin-provided note" } });
      return;
    }
    if (command === "shop") {
      const items = (await listRoleShopItems(interaction.guild.id)).filter(item => item.enabled);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFEE75C).setAuthor({ name: "🛍️ مجلساوي • ROLE SHOP" }).setTitle("متجر رتب المجتمع").setDescription(items.length ? items.map(item => `**#${item.id}** · <@&${item.roleId}> — **${item.cost}** رصيد`).join("\n") : "لا توجد رتب متاحة حالياً.").setFooter({ text: "استخدم /buyrole مع رقم العنصر" }).setTimestamp()], allowedMentions: { roles: items.map(item => item.roleId) }, ephemeral: true });
      return;
    }
    if (command === "buyrole") {
      const item = await getRoleShopItemById(interaction.options.getInteger("id", true));
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const role = item ? interaction.guild.roles.cache.get(item.roleId) : null;
      const profile = await getEconomyProfile(interaction.guild.id, interaction.user.id);
      const dangerousRolePermissions = [PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageWebhooks, PermissionFlagsBits.BanMembers, PermissionFlagsBits.KickMembers, PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.MentionEveryone];
      const eligibility = assessRoleShopPurchase({ requestedGuildId: interaction.guild.id, itemGuildId: item?.guildId, enabled: item?.enabled, roleExists: Boolean(role), roleEditable: Boolean(role?.editable), roleSafe: Boolean(role && !role.managed && !role.permissions.any(dangerousRolePermissions)), alreadyHasRole: Boolean(role && member.roles.cache.has(role.id)), balance: profile.balance, cost: item?.cost ?? 0 });
      if (!eligibility.allowed) {
        const message = eligibility.reason === "insufficient_balance" ? "رصيدك غير كافٍ لهذه الرتبة." : eligibility.reason === "already_owned" ? "تملك هذه الرتبة بالفعل." : eligibility.reason === "unsafe_role" ? "هذه الرتبة غير مؤهلة للبيع لأنها تحمل صلاحيات مرتفعة." : "عنصر المتجر غير متاح أو لا يستطيع مجلساوي إسناد رتبته.";
        throw new Error(message);
      }
      try {
        await member.roles.add(role!, `مجلساوي role shop item #${item!.id}`);
        const balance = await adjustEconomyBalance({ guildId: interaction.guild.id, memberId: interaction.user.id, amount: -item!.cost, kind: "shop", reason: `Role shop item ${item!.id}` });
        await interaction.reply({ content: `تمت إضافة رتبة **${role!.name}** وخصم **${item!.cost}**. رصيدك الآن: **${balance}**.`, ephemeral: true });
        await logDiscordEvent({ guild: interaction.guild, category: "economy", eventKey: "economy.role_shop_purchase", title: "Community role purchased", accentColor: "#FEE75C", icon: "🛍️", actorId: interaction.user.id, actorLabel: interaction.user.username, targetId: role!.id, targetLabel: role!.name, details: { "Shop item": `#${item!.id}`, "Cost": `${item!.cost}` } });
      } catch (error) {
        if (role && member.roles.cache.has(role.id)) await member.roles.remove(role, "Rollback failed role shop purchase").catch(() => undefined);
        throw error;
      }
      return;
    }
    if (command === "balance") {
      const user = interaction.options.getUser("member") ?? interaction.user;
      const profile = await getEconomyProfile(interaction.guild.id, user.id);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setAuthor({ name: "💰 مجلساوي • COMMUNITY PROFILE" }).setTitle(user.username).addFields({ name: "الرصيد", value: `${profile.balance}`, inline: true }, { name: "السمعة", value: `${profile.reputation}`, inline: true }).setTimestamp()], ephemeral: true });
      return;
    }
    if (command === "pay") {
      const target = interaction.options.getUser("member", true); const amount = interaction.options.getInteger("amount", true);
      if (target.id === interaction.user.id || target.bot) throw new Error("اختر عضواً آخر غير بوت للتحويل.");
      const cooldownKey = `${interaction.guild.id}:${interaction.user.id}:pay`;
      if (!canUseEconomyAction(economyActionUseTimes.get(cooldownKey), Date.now(), 10_000)) throw new Error("انتظر 10 ثوانٍ قبل تحويل جديد.");
      await adjustEconomyBalance({ guildId: interaction.guild.id, memberId: interaction.user.id, amount: -amount, kind: "transfer", reason: `Transfer to ${target.id}`, counterpartyId: target.id });
      const newBalance = await adjustEconomyBalance({ guildId: interaction.guild.id, memberId: target.id, amount, kind: "transfer", reason: `Transfer from ${interaction.user.id}`, counterpartyId: interaction.user.id });
      economyActionUseTimes.set(cooldownKey, Date.now());
      await interaction.reply({ content: `تم تحويل **${amount}** إلى <@${target.id}>. رصيده الجديد: **${newBalance}**.`, allowedMentions: { users: [target.id] } });
      await logDiscordEvent({ guild: interaction.guild, category: "economy", eventKey: "economy.transfer", title: "Community credit transfer", accentColor: "#FEE75C", icon: "💸", actorId: interaction.user.id, actorLabel: interaction.user.username, targetId: target.id, targetLabel: target.username, details: { "Amount": `${amount}`, "Content": "No message content retained" } });
      return;
    }
    if (command === "rep") {
      const target = interaction.options.getUser("member", true);
      if (target.id === interaction.user.id || target.bot) throw new Error("اختر عضواً آخر غير بوت للسمعة.");
      const cooldownKey = `${interaction.guild.id}:${interaction.user.id}:rep`;
      if (!canUseEconomyAction(economyActionUseTimes.get(cooldownKey), Date.now(), 24 * 60 * 60_000)) throw new Error("منحت سمعة بالفعل؛ جرّب غداً.");
      const reputation = await adjustMemberReputation({ guildId: interaction.guild.id, memberId: target.id, delta: 1 });
      economyActionUseTimes.set(cooldownKey, Date.now());
      await interaction.reply({ content: `أضفت نقطة سمعة لـ <@${target.id}>. مجموع السمعة: **${reputation}**.`, allowedMentions: { users: [target.id] } });
      return;
    }
    if (command === "suggest") {
      const content = interaction.options.getString("text", true); const anonymous = interaction.options.getBoolean("anonymous") ?? false;
      const id = await createSuggestion({ guildId: interaction.guild.id, channelId: interaction.channelId, authorId: interaction.user.id, content, anonymous });
      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`suggestion:status:${id}:accepted`).setStyle(ButtonStyle.Success).setLabel("قبول").setEmoji("✅"),
        new ButtonBuilder().setCustomId(`suggestion:status:${id}:declined`).setStyle(ButtonStyle.Danger).setLabel("رفض").setEmoji("❌"),
        new ButtonBuilder().setCustomId(`suggestion:status:${id}:implemented`).setStyle(ButtonStyle.Primary).setLabel("تم التنفيذ").setEmoji("🛠️"),
      );
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setAuthor({ name: "💡 مجلساوي • SUGGESTION" }).setTitle(`اقتراح #${id}`).setDescription(content).setFooter({ text: `${anonymous ? "اقتراح مجهول" : `من ${interaction.user.username}`} • الحالة: مفتوح` }).setTimestamp()], components: [buttons] });
      const published = await interaction.fetchReply().catch(() => null);
      if (published) await saveSuggestionMessageId({ guildId: interaction.guild.id, id, messageId: published.id });
      await logDiscordEvent({ guild: interaction.guild, category: "community", eventKey: "suggestion.created", title: "Community suggestion created", accentColor: "#3BA55D", icon: "💡", actorId: interaction.user.id, actorLabel: interaction.user.username, targetId: String(id), targetLabel: `Suggestion #${id}`, details: { "Anonymous": anonymous ? "Yes" : "No", "Content": "Not retained in interaction log" } });
      return;
    }
    if (command === "poll") {
      const options = interaction.options.getString("options", true).split("|").map(value => value.trim()).filter(Boolean).slice(0, 8);
      if (options.length < 2) throw new Error("أضف خيارين على الأقل وافصل بينها بعلامة |.");
      const question = interaction.options.getString("question", true); const anonymous = interaction.options.getBoolean("anonymous") ?? false;
      const id = await createPoll({ guildId: interaction.guild.id, channelId: interaction.channelId, question, anonymous, createdById: interaction.user.id, options });
      const savedOptions = await listPollOptions(id);
      const rows = Array.from({ length: Math.ceil(savedOptions.length / 5) }, (_, rowIndex) => new ActionRowBuilder<ButtonBuilder>().addComponents(savedOptions.slice(rowIndex * 5, rowIndex * 5 + 5).map(option => new ButtonBuilder().setCustomId(`poll:vote:${id}:${option.id}`).setStyle(ButtonStyle.Secondary).setLabel(`${option.position + 1}. ${option.label}`.slice(0, 80)))));
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setAuthor({ name: "🗳️ مجلساوي • POLL" }).setTitle(question).setDescription(options.map((option, index) => `${index + 1}. ${option}`).join("\n")).setFooter({ text: `تصويت #${id} • ${anonymous ? "مجهول" : "علني"}` }).setTimestamp()], components: rows });
      await logDiscordEvent({ guild: interaction.guild, category: "community", eventKey: "poll.created", title: "Community poll created", accentColor: "#5865F2", icon: "🗳️", actorId: interaction.user.id, actorLabel: interaction.user.username, targetId: String(id), targetLabel: `Poll #${id}`, details: { "Options": `${options.length}`, "Anonymous": anonymous ? "Yes" : "No" } });
      return;
    }
    if (command === "pollend") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) { await interaction.reply({ content: "إنهاء التصويت لإدارة السيرفر فقط.", ephemeral: true }); return; }
      const id = interaction.options.getInteger("id", true);
      const poll = await getPollById(id);
      const eligibility = assessPollClose({ requestedGuildId: interaction.guild.id, pollGuildId: poll?.guildId, status: poll?.status });
      if (!eligibility.allowed) throw new Error(eligibility.reason === "not_active" ? "هذا التصويت مغلق مسبقاً." : "هذا التصويت غير متاح في هذا السيرفر.");
      const closed = await closePoll({ guildId: interaction.guild.id, id });
      if (!closed) throw new Error("تم إغلاق التصويت مسبقاً، أعد المحاولة.");
      const results = await listPollResults(id);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setAuthor({ name: "🗳️ مجلساوي • POLL RESULTS" }).setTitle(`نتائج التصويت #${id}`).setDescription(formatPollResults(results)).setFooter({ text: `عدد الأصوات: ${results.reduce((total, row) => total + row.votes, 0)} • لا يعرض هوية المصوتين` }).setTimestamp()] });
      await logDiscordEvent({ guild: interaction.guild, category: "community", eventKey: "poll.closed", title: "Community poll closed", accentColor: "#5865F2", icon: "🗳️", actorId: interaction.user.id, actorLabel: interaction.user.username, targetId: String(id), targetLabel: poll?.question ?? `Poll #${id}`, details: { "Votes": `${results.reduce((total, row) => total + row.votes, 0)}`, "Voter identities": "Not retained" } });
      return;
    }
    if (command === "event") {
      const minutes = interaction.options.getInteger("minutes", true); const startsAt = new Date(Date.now() + minutes * 60_000);
      const title = interaction.options.getString("title", true); const description = interaction.options.getString("description", true);
      const id = await createCommunityEvent({ guildId: interaction.guild.id, channelId: interaction.channelId, title, description, startsAt, reminderMinutes: 30, createdById: interaction.user.id });
      const going = new ButtonBuilder().setCustomId(`event:rsvp:${id}:going`).setStyle(ButtonStyle.Success).setLabel("بحضر").setEmoji("✅");
      const maybe = new ButtonBuilder().setCustomId(`event:rsvp:${id}:maybe`).setStyle(ButtonStyle.Secondary).setLabel("ممكن").setEmoji("❔");
      const declined = new ButtonBuilder().setCustomId(`event:rsvp:${id}:declined`).setStyle(ButtonStyle.Danger).setLabel("ما أقدر").setEmoji("❌");
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setAuthor({ name: "📅 مجلساوي • EVENT" }).setTitle(title).setDescription(description).addFields({ name: "الوقت", value: `<t:${Math.floor(startsAt.getTime() / 1000)}:R>` }).setFooter({ text: `فعالية #${id}` }).setTimestamp()], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(going, maybe, declined)] });
      await logDiscordEvent({ guild: interaction.guild, category: "community", eventKey: "event.created", title: "Community event created", accentColor: "#57F287", icon: "📅", actorId: interaction.user.id, actorLabel: interaction.user.username, targetId: String(id), targetLabel: title, details: { "Starts": `<t:${Math.floor(startsAt.getTime() / 1000)}:F>` } });
      return;
    }
    if (command === "eventend") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) { await interaction.reply({ content: "إنهاء الفعالية لإدارة السيرفر فقط.", ephemeral: true }); return; }
      const id = interaction.options.getInteger("id", true);
      const event = await getCommunityEventById(id);
      const eligibility = assessEventClose({ requestedGuildId: interaction.guild.id, eventGuildId: event?.guildId, status: event?.status });
      if (!eligibility.allowed) throw new Error(eligibility.reason === "not_scheduled" ? "هذه الفعالية منتهية أو ملغاة مسبقاً." : "هذه الفعالية غير متاحة في هذا السيرفر.");
      const closed = await closeCommunityEvent({ guildId: interaction.guild.id, id });
      if (!closed) throw new Error("تم إنهاء الفعالية مسبقاً، أعد المحاولة.");
      const summary = await getEventRsvpSummary(id);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setAuthor({ name: "📅 مجلساوي • EVENT SUMMARY" }).setTitle(`ملخص فعالية #${id}`).setDescription(formatEventRsvpSummary(summary)).setFooter({ text: "الأرقام مجمعة ولا تعرض هوية المشاركين" }).setTimestamp()] });
      await logDiscordEvent({ guild: interaction.guild, category: "community", eventKey: "event.completed", title: "Community event completed", accentColor: "#57F287", icon: "📅", actorId: interaction.user.id, actorLabel: interaction.user.username, targetId: String(id), targetLabel: event?.title ?? `Event #${id}`, details: { "Going": `${summary.find(row => row.state === "going")?.total ?? 0}`, "Member identities": "Not retained" } });
      return;
    }
    if (command === "giveaway") {
      const minutes = interaction.options.getInteger("minutes", true); const endsAt = new Date(Date.now() + minutes * 60_000); const prize = interaction.options.getString("prize", true); const winnerCount = interaction.options.getInteger("winners", true);
      const id = await createGiveaway({ guildId: interaction.guild.id, channelId: interaction.channelId, prize, winnerCount, minimumLevel: 0, endsAt, createdById: interaction.user.id });
      const enter = new ButtonBuilder().setCustomId(`giveaway:enter:${id}`).setStyle(ButtonStyle.Primary).setLabel("دخول السحب").setEmoji("🎉");
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xfee75c).setAuthor({ name: "🎁 مجلساوي • GIVEAWAY" }).setTitle(prize).setDescription(`عدد الفائزين: **${winnerCount}**\nينتهي <t:${Math.floor(endsAt.getTime() / 1000)}:R>`).setFooter({ text: `سحب #${id}` }).setTimestamp()], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(enter)] });
      await logDiscordEvent({ guild: interaction.guild, category: "community", eventKey: "giveaway.created", title: "Giveaway created", accentColor: "#FEE75C", icon: "🎁", actorId: interaction.user.id, actorLabel: interaction.user.username, targetId: String(id), targetLabel: prize, details: { "Winners": `${winnerCount}`, "Ends": `<t:${Math.floor(endsAt.getTime() / 1000)}:R>` } });
      return;
    }
    if (command === "giveawayend") {
      const id = interaction.options.getInteger("id", true);
      const giveaway = await getGiveawayById(id);
      if (!giveaway || giveaway.guildId !== interaction.guild.id || giveaway.status !== "active") throw new Error("لا يوجد سحب نشط بهذا الرقم.");
      const entries = await listGiveawayEntries(id);
      const pool = Array.from(new Set(entries.map(entry => entry.memberId))).sort(() => Math.random() - 0.5);
      const winners = pool.slice(0, giveaway.winnerCount);
      await finishGiveaway({ id, winnerIds: winners });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setAuthor({ name: "🎉 مجلساوي • GIVEAWAY ENDED" }).setTitle(giveaway.prize).setDescription(winners.length ? `الفائزون: ${winners.map(winner => `<@${winner}>`).join("، ")}` : "لم يدخل أي عضو مؤهل في السحب.").setFooter({ text: `سحب #${id} • مشاركون: ${pool.length}` }).setTimestamp()], allowedMentions: { users: winners } });
      await logDiscordEvent({ guild: interaction.guild, category: "community", eventKey: "giveaway.ended", title: "Giveaway ended", accentColor: "#57F287", icon: "🎉", actorId: interaction.user.id, actorLabel: interaction.user.username, targetId: String(id), targetLabel: giveaway.prize, details: { "Entries": `${pool.length}`, "Winners": winners.length ? winners.map(winner => `\`${winner}\``).join(", ") : "None" } });
      return;
    }
    if (command === "ticketpanel") {
      const title = interaction.options.getString("title", true); const description = interaction.options.getString("description", true); const role = interaction.options.getRole("staff_role", true);
      const id = await createTicketPanel({ guildId: interaction.guild.id, channelId: interaction.channelId, staffRoleId: role.id, title, description });
      const openTicket = new ButtonBuilder().setCustomId(`ticket:open:${id}`).setStyle(ButtonStyle.Primary).setLabel("فتح تذكرة").setEmoji("🎫");
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setAuthor({ name: "🎫 مجلساوي • SUPPORT" }).setTitle(title).setDescription(description).setFooter({ text: `لوحة تذاكر #${id} • الفريق: ${role.name}` }).setTimestamp()], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(openTicket)] });
      await logDiscordEvent({ guild: interaction.guild, category: "tickets", eventKey: "ticket.panel_created", title: "Support ticket panel created", accentColor: "#5865F2", icon: "🎫", actorId: interaction.user.id, actorLabel: interaction.user.username, targetId: String(id), targetLabel: title, details: { "Staff role": `<@&${role.id}>` } });
    }
  } catch (error) { await interaction.reply({ content: `تعذر تنفيذ النظام المجتمعي: ${error instanceof Error ? error.message : "خطأ غير معروف"}`, ephemeral: true }); }
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

export async function handleModerationCommand(interaction: ChatInputCommandInteraction) {
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
    const amount = normalizeXpAdjustment(interaction.options.getInteger("amount", true));
    if (!canApplyXpAdjustment(amount)) throw new Error("مقدار XP يجب ألا يكون صفراً.");
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
      case "warn": {
        const settings = await getGuildSettings(interaction.guild.id);
        await createWarningRecord({ guildId: interaction.guild.id, memberId: target!.id, memberLabel: target!.displayName, moderatorId: interaction.user.id, moderatorLabel: interaction.user.username, reason, expiresAt: resolveWarningExpiry(new Date(), settings?.warningExpiryDays ?? 30) });
        const warningCount = await countActiveWarnings(interaction.guild.id, target!.id);
        if (warningCount >= (settings?.warningLimit ?? 3)) {
          if (settings?.autoKickEnabled) await target!.kick(`Warning threshold reached: ${reason}`);
          else await target!.timeout((settings?.autoMuteMinutes ?? 10) * 60_000, `Warning threshold reached: ${reason}`);
        }
        break;
      }
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

export async function handleSuggestionStatusButton(interaction: ButtonInteraction) {
  if (!interaction.guild || !interaction.customId.startsWith("suggestion:status:")) return;
  const [, , suggestionIdRaw, requestedStatus] = interaction.customId.split(":");
  const suggestionId = Number(suggestionIdRaw);
  try {
    const authorized = await canUseModerationAction(interaction.guild, interaction.user.id, "community_manage", PermissionFlagsBits.ManageGuild);
    if (!authorized) throw new Error("ليس لديك صلاحية أو رتبة إدارة الاقتراحات.");
    if (!Number.isInteger(suggestionId)) throw new Error("معرّف الاقتراح غير صالح.");
    const suggestion = await getSuggestionById(suggestionId);
    const decision = assessSuggestionStatusUpdate({ suggestionGuildId: suggestion?.guildId, requestedGuildId: interaction.guild.id, currentStatus: suggestion?.status, requestedStatus });
    if (!decision.allowed) throw new Error(decision.reason === "already_decided" ? "تم حسم هذا الاقتراح مسبقاً." : "هذا الاقتراح غير متاح في هذا السيرفر.");
    const updated = await updateSuggestionStatus({ guildId: interaction.guild.id, id: suggestionId, status: decision.status });
    if (!updated) throw new Error("تم تحديث حالة الاقتراح مسبقاً، أعد فتح الرسالة.");
    const label = decision.status === "accepted" ? "مقبول" : decision.status === "declined" ? "مرفوض" : "تم التنفيذ";
    const color = decision.status === "accepted" ? 0x57F287 : decision.status === "declined" ? 0xED4245 : 0x5865F2;
    const embed = interaction.message.embeds[0] ? EmbedBuilder.from(interaction.message.embeds[0]) : new EmbedBuilder().setTitle(`اقتراح #${suggestionId}`);
    embed.setColor(color).setFooter({ text: `الحالة: ${label} • تم الحسم بواسطة فريق الإدارة` });
    await interaction.update({ embeds: [embed], components: [] });
    await logDiscordEvent({ guild: interaction.guild, category: "community", eventKey: "suggestion.status_updated", title: "Suggestion status updated", accentColor: decision.status === "declined" ? "#ED4245" : "#57F287", icon: "💡", actorId: interaction.user.id, actorLabel: interaction.user.username, targetId: String(suggestionId), targetLabel: `Suggestion #${suggestionId}`, details: { "Status": decision.status, "Suggestion content": "Not retained in audit log" } });
  } catch (error) {
    await interaction.reply({ content: `تعذر تحديث الاقتراح: ${error instanceof Error ? error.message : "خطأ غير معروف"}`, ephemeral: true });
  }
}

export async function handleTriviaButton(interaction: ButtonInteraction) {
  if (!interaction.guild || !interaction.customId.startsWith("trivia:answer:")) return;
  const [, , nonce, optionIndexRaw] = interaction.customId.split(":");
  const pending = nonce ? pendingTriviaRounds.get(nonce) : undefined;
  const decision = assessTriviaAnswer({ pending, guildId: interaction.guild.id, actorId: interaction.user.id, optionIndex: Number(optionIndexRaw), now: Date.now() });
  if (!decision.allowed) {
    if (nonce && decision.reason === "expired") pendingTriviaRounds.delete(nonce);
    const message = decision.reason === "not_owner" ? "هذه الجولة تخص العضو الذي بدأها فقط." : decision.reason === "expired" ? "انتهت مهلة هذه الجولة." : "هذه الجولة لم تعد متاحة.";
    await interaction.reply({ content: message, ephemeral: true });
    return;
  }
  pendingTriviaRounds.delete(nonce);
  const embed = interaction.message.embeds[0] ? EmbedBuilder.from(interaction.message.embeds[0]) : new EmbedBuilder().setTitle("Trivia");
  embed.setColor(decision.correct ? 0x57F287 : 0xED4245).setDescription(`${pending!.question.prompt}\n\n${decision.correct ? "✅ إجابة صحيحة!" : `❌ ليست الإجابة الصحيحة. الإجابة: **${decision.answer}**`}`).setFooter({ text: "انتهت الجولة • بلا جوائز أو رهانات" });
  await interaction.update({ embeds: [embed], components: [] });
  await logDiscordEvent({ guild: interaction.guild, category: "community", eventKey: "trivia.answered", title: "Trivia round answered", accentColor: decision.correct ? "#57F287" : "#ED4245", icon: "🧠", actorId: interaction.user.id, actorLabel: interaction.user.username, details: { "Question": pending!.question.id, "Outcome": decision.correct ? "Correct" : "Incorrect", "Answer text": "Not retained" } });
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
const messageWindows = new Map<string, number[]>();
const xpAwardTimes = new Map<string, number>();
const raidWindows = new Map<string, number[]>();

async function applyAutomaticModeration(input: { guild: Guild; member: GuildMember; action: "delete" | "warn" | "mute" | "kick"; reason: string; message?: { delete: () => Promise<unknown> } | null }) {
  const settings = await getGuildSettings(input.guild.id);
  const bot = input.guild.members.me ?? await input.guild.members.fetchMe().catch(() => null);
  if (input.action === "delete" || input.action === "warn" || input.action === "mute" || input.action === "kick") {
    await input.message?.delete().catch(() => undefined);
  }
  const executor = entity(bot?.id, bot?.displayName ?? "مجلساوي");
  if (input.action !== "delete" && executor.id && executor.label) {
    await createWarningRecord({ guildId: input.guild.id, memberId: input.member.id, memberLabel: input.member.displayName, moderatorId: executor.id, moderatorLabel: executor.label, reason: input.reason, expiresAt: resolveWarningExpiry(new Date(), settings?.warningExpiryDays ?? 30) });
    const warnings = await countActiveWarnings(input.guild.id, input.member.id);
    if (input.action === "mute" || warnings >= (settings?.warningLimit ?? 3)) {
      await input.member.timeout((settings?.autoMuteMinutes ?? 10) * 60_000, input.reason).catch(() => undefined);
    }
    if (input.action === "kick" || ((settings?.autoKickEnabled ?? false) && warnings >= (settings?.warningLimit ?? 3))) {
      await input.member.kick(input.reason).catch(() => undefined);
    }
  }
  await logDiscordEvent({ guild: input.guild, category: "moderation", eventKey: "automod.action", title: "AutoMod action applied", accentColor: "#ED4245", icon: "🛡️", actorId: bot?.id, actorLabel: bot?.displayName ?? "مجلساوي", targetId: input.member.id, targetLabel: input.member.displayName, reason: input.reason, details: { "Action": input.action.toUpperCase(), "Policy": "Content is not retained in logs" } });
}

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

export async function listGuildTicketCategories(guildId: string) {
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) return [];
  const channels = await guild.channels.fetch().catch(() => guild.channels.cache);
  const botMember = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
  return Array.from(channels.values())
    .filter((channel): channel is NonNullable<typeof channel> => Boolean(channel && channel.type === ChannelType.GuildCategory))
    .filter(channel => {
      const permissions = botMember ? channel.permissionsFor(botMember) : null;
      return canManageTicketCategory({ isCategory: channel.type === ChannelType.GuildCategory, botCanView: Boolean(permissions?.has(PermissionFlagsBits.ViewChannel)), botCanManageChannels: Boolean(permissions?.has(PermissionFlagsBits.ManageChannels)) });
    })
    .map(channel => ({ id: channel.id, name: channel.name }));
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

export async function sendStreamAnnouncement(input: {
  guildId: string;
  destinationChannelId: string;
  mentionRoleId?: string | null;
  sourceLabel: string;
  sourceUrl?: string | null;
  messageTemplate?: string | null;
  title: string;
  streamUrl: string;
  thumbnailUrl?: string | null;
}) {
  const guild = client?.guilds.cache.get(input.guildId);
  if (!guild) throw new Error("السيرفر غير متصل بالبوت.");
  const channel = await guild.channels.fetch(input.destinationChannelId).catch(() => null);
  if (!channel?.isTextBased()) throw new Error("قناة إعلان البث غير صالحة.");
  const replace = (value: string) => value
    .replaceAll("{title}", input.title)
    .replaceAll("{url}", input.streamUrl)
    .replaceAll("{platform}", input.sourceLabel)
    .slice(0, 1800);
  const description = replace(input.messageTemplate || "🔴 **{title}** بدأ البث الآن على {platform}!\n{url}");
  const embed = new EmbedBuilder()
    .setColor(0xEF4444)
    .setAuthor({ name: `🔴 مجلساوي • ${input.sourceLabel}` })
    .setTitle(input.title.slice(0, 256))
    .setDescription(description)
    .setURL(input.streamUrl)
    .addFields({ name: "رابط البث", value: `[اضغط للمشاهدة](${input.streamUrl})` })
    .setTimestamp();
  if (input.thumbnailUrl && /^https:\/\//i.test(input.thumbnailUrl)) embed.setThumbnail(input.thumbnailUrl);
  const mention = input.mentionRoleId ? `<@&${input.mentionRoleId}>` : undefined;
  await channel.send({ content: mention, embeds: [embed], allowedMentions: { roles: input.mentionRoleId ? [input.mentionRoleId] : [] } });
  await logDiscordEvent({ guild, category: "community", eventKey: "stream.announcement_sent", title: "Live-stream announcement sent", accentColor: "#EF4444", icon: "🔴", targetLabel: input.title.slice(0, 96), details: { "Platform": input.sourceLabel, "Destination": `<#${input.destinationChannelId}>`, "Role mention": input.mentionRoleId ? `<@&${input.mentionRoleId}>` : "None", "Inbound payload": "Not retained" } });
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
  const card = await createWelcomeCard({ guildName: guild.name, memberName, avatarUrl, message, memberCount: guild.memberCount, cardConfig: settings.welcomeCardConfig });
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
      await syncMemberCounter(member.guild, settings?.memberCountChannelId);
      if (settings?.antiBotEnabled && member.user.bot) {
        await member.kick("مجلساوي Anti-Bot").catch(() => undefined);
        await logDiscordEvent({ guild: member.guild, category: "moderation", eventKey: "antibot.removed", title: "Bot account removed by Anti-Bot", accentColor: "#ED4245", icon: "🤖", targetId: member.id, targetLabel: member.user.username, details: { "Policy": "Anti-Bot enabled" } });
        return;
      }
      if (settings?.antiRaidEnabled) {
        const now = Date.now(); const key = member.guild.id;
        const updated = updateWindow(raidWindows.get(key) ?? [], now, settings.antiRaidWindowSeconds, settings.antiRaidJoinLimit);
        raidWindows.set(key, updated.active);
        if (updated.triggered) await logDiscordEvent({ guild: member.guild, category: "moderation", eventKey: "antiraid.threshold", title: "Anti-Raid threshold reached", accentColor: "#ED4245", icon: "🚨", details: { "Joins": `${updated.active.length}`, "Window": `${settings.antiRaidWindowSeconds}s`, "Policy": "Review joins; no mass action is taken automatically" } });
      }
      if (settings?.welcomeAutoRoleId) {
        const role = await member.guild.roles.fetch(settings.welcomeAutoRoleId).catch(() => null);
        const dangerousPermissions = [PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageWebhooks, PermissionFlagsBits.BanMembers, PermissionFlagsBits.KickMembers, PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.MentionEveryone];
        const plan = assessWelcomeAutoRole({ configuredRoleId: settings.welcomeAutoRoleId, roleExists: Boolean(role), roleEditable: Boolean(role?.editable), roleSafe: Boolean(role && !role.managed && !role.permissions.any(dangerousPermissions)), alreadyHasRole: Boolean(role && member.roles.cache.has(role.id)), memberIsBot: member.user.bot });
        if (plan.allowed) {
          await member.roles.add(role!, "مجلساوي welcome auto-role");
          await logDiscordEvent({ guild: member.guild, category: "welcome", eventKey: "welcome.auto_role_assigned", title: "Welcome auto-role assigned", accentColor: "#57F287", icon: "👋", targetId: member.id, targetLabel: member.user.username, details: { "Role": `<@&${role!.id}>` } });
        } else if (plan.reason === "unmanageable" || plan.reason === "unsafe") {
          await logDiscordEvent({ guild: member.guild, category: "welcome", eventKey: "welcome.auto_role_skipped", title: "Welcome auto-role skipped for safety", accentColor: "#ED4245", icon: "🛡️", details: { "Outcome": plan.reason, "Role ID": settings.welcomeAutoRoleId } });
        }
      }
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
          memberCount: member.guild.memberCount,
          cardConfig: settings.welcomeCardConfig,
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
      const settings = await getGuildSettings(member.guild.id);
      await syncMemberCounter(member.guild, settings?.memberCountChannelId);
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
      const settings = await getGuildSettings(message.guild!.id);
      const member = message.member;
      if (!settings || !member) return;
      const moderationWindowKey = `${message.guild!.id}:${message.author.id}`;
      const window = updateWindow(messageWindows.get(moderationWindowKey) ?? [], Date.now(), settings.antiSpamWindowSeconds, settings.antiSpamMaxMessages);
      messageWindows.set(moderationWindowKey, window.active);
      if (settings.antiSpamEnabled && window.triggered) { await applyAutomaticModeration({ guild: message.guild!, member, action: "mute", reason: "Anti-Spam threshold exceeded", message }); return; }
      if (settings.antiLinkEnabled && detectLink(message.content)) { await applyAutomaticModeration({ guild: message.guild!, member, action: "delete", reason: "Anti-Link rule", message }); return; }
      const memberRoleIds = Array.from(member.roles.cache.keys());
      const customRules = await listAutoModRules(message.guild!.id);
      const matchedRule = customRules.find(rule => rule.enabled && (!rule.exemptRoleId || !memberRoleIds.includes(rule.exemptRoleId)) && detectAutoModRule(message.content, rule).matched);
      if (matchedRule) { await applyAutomaticModeration({ guild: message.guild!, member, action: matchedRule.action, reason: `AutoMod: ${matchedRule.name}`, message }); return; }
      if (!settings.xpEnabled) return;
      const xpKey = `${message.guild!.id}:${message.author.id}`;
      const lastAward = xpAwardTimes.get(xpKey) ?? 0;
      if (Date.now() - lastAward < settings.xpCooldownSeconds * 1000) return;
      xpAwardTimes.set(xpKey, Date.now());
      const xp = await adjustMemberXp({ guildId: message.guild!.id, memberId: message.author.id, memberLabel: message.member?.displayName ?? message.author.username, delta: settings.xpPerMessage });
      if (!xp.levelChanged) return;
      const rewards = await listLevelRoleRewards(message.guild!.id);
      const reward = rewards.find(item => item.level === xp.level);
      if (reward) await member.roles.add(reward.roleId, "مجلساوي level reward").catch(() => undefined);
      const destination = settings.xpAnnouncementChannelId ? await message.guild!.channels.fetch(settings.xpAnnouncementChannelId).catch(() => null) : message.channel;
      if (destination?.isTextBased()) await destination.send({ content: renderLevelUpMessage(settings.xpLevelUpMessage, { user: `<@${message.author.id}>`, level: xp.level, xp: xp.xp }), allowedMentions: { users: [message.author.id] } }).catch(() => undefined);
      await logDiscordEvent({ guild: message.guild!, category: "xp", eventKey: "xp.level_up", title: "Member levelled up", accentColor: "#00D4AA", icon: "✨", targetId: message.author.id, targetLabel: message.member?.displayName ?? message.author.username, details: { "Level": `${xp.level}`, "XP": `${xp.xp}`, "Reward": reward ? `<@&${reward.roleId}>` : "No role configured" } });
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
      else if (communityCommandNames.has(interaction.commandName)) void handleCommunityCommand(interaction);
      else void handleModerationCommand(interaction);
    }
      if (interaction.isButton() && interaction.customId.startsWith("adminassist:") && interaction.guild) {
        const [, decision, nonce] = interaction.customId.split(":");
        const pending = nonce ? pendingAdminActions.get(nonce) : undefined;
        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        const confirmation = validateAdminAssistantConfirmation({ pending, guildId: interaction.guild.id, actorId: interaction.user.id, now: Date.now(), hasManageGuild: Boolean(member?.permissions.has(PermissionFlagsBits.ManageGuild)) });
        if (!confirmation.allowed) {
          if (nonce && confirmation.reason === "expired") pendingAdminActions.delete(nonce);
          await logDiscordEvent({ guild: interaction.guild, category: "system", eventKey: "admin_assistant.confirmation_rejected", title: "Safe admin assistant confirmation rejected", accentColor: "#ED4245", icon: "🛡️", actorId: interaction.user.id, actorLabel: interaction.user.username, details: { "Outcome": confirmation.reason, "Request text": "Not retained" } });
          await interaction.reply({ content: confirmation.reason === "permission_revoked" ? "لم تعد تملك Manage Server؛ لن ينفذ مجلساوي التغيير." : "انتهت المعاينة أو لا تخص حسابك. أرسل طلباً جديداً عبر /adminassist.", ephemeral: true });
          return;
        }
        pendingAdminActions.delete(nonce);
        if (decision === "cancel") {
          await logDiscordEvent({ guild: interaction.guild, category: "system", eventKey: "admin_assistant.cancelled", title: "Safe admin assistant action cancelled", accentColor: "#FEE75C", icon: "🛡️", actorId: interaction.user.id, actorLabel: interaction.user.username, details: { "Outcome": "Cancelled", "Request text": "Not retained" } });
          await interaction.update({ content: "تم إلغاء التغيير الآمن.", embeds: [], components: [] });
          return;
        }
        try {
          const botMember = interaction.guild.members.me;
          if (!botMember) throw new Error("تعذر التحقق من عضو البوت داخل السيرفر.");
          const proposal = pending!.proposal;
          const capability = validateBotAdminAssistantCapability(proposal, { manageChannels: Boolean(botMember?.permissions.has(PermissionFlagsBits.ManageChannels)), manageRoles: Boolean(botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) });
          if (!capability.allowed) throw new Error(capability.reason === "missing_manage_roles" ? "البوت يحتاج Manage Roles لإنشاء الرتبة." : "البوت يحتاج Manage Channels لإدارة الروم.");
          let targetLabel = "";
          if (proposal.kind === "create_channel") {
            if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) throw new Error("البوت يحتاج Manage Channels لإنشاء الروم.");
            const channel = await interaction.guild.channels.create({ name: proposal.name, type: ChannelType.GuildText, permissionOverwrites: proposal.visibility === "private" ? [{ id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }] : [], reason: "مجلساوي safe admin assistant" });
            targetLabel = `#${channel.name}`;
          } else if (proposal.kind === "create_role") {
            if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) throw new Error("البوت يحتاج Manage Roles لإنشاء الرتبة.");
            const role = await interaction.guild.roles.create({ name: proposal.name, permissions: [], reason: "مجلساوي safe admin assistant" });
            targetLabel = role.name;
          } else if (proposal.kind === "create_jail_role") {
            const allowedChannel = interaction.guild.channels.cache.find(item => item.type === ChannelType.GuildText && item.name === proposal.allowedChannelName) as TextChannel | undefined;
            if (!allowedChannel) throw new Error("لم أجد روم سجن نصي مطابقاً للاسم المطلوب.");
            const existingRole = interaction.guild.roles.cache.find(role => role.name.toLocaleLowerCase() === proposal.roleName.toLocaleLowerCase());
            if (existingRole) throw new Error("توجد رتبة بنفس الاسم بالفعل؛ اختر اسماً جديداً بدلاً من تعديل رتبة موجودة.");
            const channelsToRestrict = Array.from(interaction.guild.channels.cache.values()).filter((item): item is NonThreadGuildBasedChannel => item.id !== allowedChannel.id && item.type !== ChannelType.GuildCategory && "permissionOverwrites" in item);
            const inaccessibleChannel = channelsToRestrict.find(item => !item.permissionsFor(botMember).has(PermissionFlagsBits.ManageChannels));
            if (!allowedChannel.permissionsFor(botMember).has(PermissionFlagsBits.ManageChannels) || inaccessibleChannel) throw new Error(`البوت يحتاج Manage Channels في كل الرومات المستهدفة${inaccessibleChannel ? `، ومنها #${inaccessibleChannel.name}` : ""}.`);
            const role = await interaction.guild.roles.create({ name: proposal.roleName, permissions: [], reason: "مجلساوي confirmed jail-role assistant" });
            try {
              await Promise.all(channelsToRestrict.map(channel => channel.permissionOverwrites.edit(role, { ViewChannel: false, SendMessages: false, Connect: false, Speak: false }, { reason: "مجلساوي jail-role access plan" })));
              await allowedChannel.permissionOverwrites.edit(role, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }, { reason: "مجلساوي jail-role allowed room" });
              await saveGuildSettings({ guildId: interaction.guild.id, guildName: interaction.guild.name, jailRoleId: role.id, jailChannelId: allowedChannel.id });
            } catch (error) {
              await role.delete("مجلساوي rollback for incomplete jail-role plan").catch(() => undefined);
              throw error;
            }
            targetLabel = `${role.name} → #${allowedChannel.name}`;
          } else {
            if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) throw new Error("البوت يحتاج Manage Channels لتعديل ظهور الروم.");
            const channel = interaction.guild.channels.cache.find(item => item.type === ChannelType.GuildText && item.name === proposal.channelName) as TextChannel | undefined;
            if (!channel) throw new Error("لم أجد روم نصي مطابقاً للاسم المطلوب.");
            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, proposal.visibility === "private" ? { ViewChannel: false } : { ViewChannel: true }, { reason: "مجلساوي safe visibility update" });
            targetLabel = `#${channel.name}`;
          }
          await interaction.update({ content: `تم تنفيذ التغيير الآمن بنجاح: **${targetLabel}**.`, embeds: [], components: [] });
          await logDiscordEvent({ guild: interaction.guild, category: "system", eventKey: "admin_assistant.executed", title: "Safe admin assistant action executed", accentColor: "#57F287", icon: "🛡️", actorId: interaction.user.id, actorLabel: interaction.user.username, targetLabel, details: { "Action": proposal.kind, "Request text": "Not retained", "Safety": "Confirmed, permission rechecked" } });
        } catch (error) {
          await logDiscordEvent({ guild: interaction.guild, category: "system", eventKey: "admin_assistant.failed", title: "Safe admin assistant action failed", accentColor: "#ED4245", icon: "🛡️", actorId: interaction.user.id, actorLabel: interaction.user.username, details: { "Outcome": error instanceof Error ? error.message.slice(0, 160) : "Unknown error", "Request text": "Not retained" } });
          await interaction.reply({ content: `لم ينفذ التغيير: ${error instanceof Error ? error.message : "خطأ غير معروف"}`, ephemeral: true });
        }
        return;
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
      if (interaction.isButton() && interaction.customId.startsWith("suggestion:status:") && interaction.guild) {
        await handleSuggestionStatusButton(interaction);
        return;
      }
      if (interaction.isButton() && interaction.customId.startsWith("trivia:answer:") && interaction.guild) {
        await handleTriviaButton(interaction);
        return;
      }
      if (interaction.isButton() && interaction.customId.startsWith("event:rsvp:") && interaction.guild) {
        const [, , eventIdRaw, state] = interaction.customId.split(":");
        const eventId = Number(eventIdRaw);
        try {
          const event = await getCommunityEventById(eventId);
          const eligibility = assessEventRsvp({ requestedGuildId: interaction.guild.id, eventGuildId: event?.guildId, status: event?.status, state });
          if (!eligibility.allowed) throw new Error(eligibility.reason === "invalid_state" ? "حالة الحضور غير صالحة." : "هذه الفعالية غير متاحة للحضور الآن.");
          await setEventRsvp({ eventId, memberId: interaction.user.id, state: state as "going" | "maybe" | "declined" });
          const label = state === "going" ? "بحضر" : state === "maybe" ? "ممكن" : "ما أقدر";
          await interaction.reply({ content: `تم تسجيل حالتك للفعالية: **${label}**. يمكنك تغييرها من الأزرار.`, ephemeral: true });
          await logDiscordEvent({ guild: interaction.guild, category: "community", eventKey: "event.rsvp", title: "Event RSVP recorded", accentColor: "#57F287", icon: "📅", actorId: interaction.user.id, actorLabel: interaction.user.username, targetId: String(eventId), targetLabel: event?.title ?? `Event #${eventId}`, details: { "State": state } });
        } catch (error) {
          await interaction.reply({ content: `تعذر تحديث الحضور: ${error instanceof Error ? error.message : "خطأ غير معروف"}`, ephemeral: true });
        }
        return;
      }
      if (interaction.isButton() && interaction.customId.startsWith("poll:vote:") && interaction.guild) {
        const [, , pollIdRaw, optionIdRaw] = interaction.customId.split(":");
        const pollId = Number(pollIdRaw); const optionId = Number(optionIdRaw);
        try {
          const poll = await getPollById(pollId);
          const option = (await listPollOptions(pollId)).find(item => item.id === optionId);
          const eligibility = assessPollVote({ requestedGuildId: interaction.guild.id, pollGuildId: poll?.guildId, status: poll?.status, endsAt: poll?.endsAt, optionExists: Boolean(option), now: Date.now() });
          if (!eligibility.allowed) throw new Error(eligibility.reason === "invalid_option" ? "خيار التصويت غير صالح." : "هذا التصويت مغلق أو غير متاح.");
          if (!option) throw new Error("خيار التصويت غير صالح.");
          await votePoll({ pollId, optionId, memberId: interaction.user.id });
          await interaction.reply({ content: `تم تسجيل اختيارك: **${option.label}**. يمكنك تغييره باختيار زر آخر قبل إغلاق التصويت.`, ephemeral: true });
          await logDiscordEvent({ guild: interaction.guild, category: "community", eventKey: "poll.vote", title: "Poll vote recorded", accentColor: "#5865F2", icon: "🗳️", actorId: interaction.user.id, actorLabel: interaction.user.username, targetId: String(pollId), targetLabel: `Poll #${pollId}`, details: { "Outcome": "Vote recorded", "Choice": poll.anonymous ? "Anonymous" : `Option ${option.position + 1}` } });
        } catch (error) {
          await interaction.reply({ content: `تعذر تسجيل التصويت: ${error instanceof Error ? error.message : "خطأ غير معروف"}`, ephemeral: true });
        }
        return;
      }
      if (interaction.isButton() && interaction.customId.startsWith("giveaway:enter:") && interaction.guild) {
        const giveawayId = Number(interaction.customId.split(":")[2]);
        try {
          const giveaway = await getGiveawayById(giveawayId);
          const member = await interaction.guild.members.fetch(interaction.user.id);
          const memberLevel = await getMemberLevel(interaction.guild.id, interaction.user.id);
          const eligibility = assessGiveawayEntry({ giveawayGuildId: giveaway?.guildId, requestedGuildId: interaction.guild.id, status: giveaway?.status, endsAt: giveaway?.endsAt, requiredRoleId: giveaway?.requiredRoleId, memberRoleIds: new Set(member.roles.cache.keys()), minimumLevel: giveaway?.minimumLevel ?? 0, memberLevel, now: Date.now() });
          if (!eligibility.allowed) {
            const message = eligibility.reason === "required_role" ? "لا تملك الرتبة المطلوبة لهذا السحب." : eligibility.reason === "minimum_level" ? `تحتاج المستوى ${giveaway?.minimumLevel ?? 0} للدخول في هذا السحب.` : "هذا السحب مغلق أو غير متاح.";
            throw new Error(message);
          }
          const added = await enterGiveaway({ giveawayId, memberId: interaction.user.id });
          await interaction.reply({ content: added ? "تم تسجيل دخولك في السحب بنجاح." : "أنت مسجل في هذا السحب مسبقاً.", ephemeral: true });
          await logDiscordEvent({ guild: interaction.guild, category: "community", eventKey: "giveaway.entry", title: "Giveaway entry recorded", accentColor: "#FEE75C", icon: "🎉", actorId: interaction.user.id, actorLabel: interaction.user.username, targetId: String(giveawayId), targetLabel: `Giveaway #${giveawayId}`, details: { "Outcome": added ? "Entered" : "Already entered" } });
        } catch (error) {
          await interaction.reply({ content: `تعذر تسجيل الدخول في السحب: ${error instanceof Error ? error.message : "خطأ غير معروف"}`, ephemeral: true });
        }
      }
      if (interaction.isButton() && interaction.customId.startsWith("ticket:open:") && interaction.guild) {
        const panelId = Number(interaction.customId.split(":")[2]);
        try {
          const panel = await getTicketPanelById(panelId);
          if (!panel || panel.guildId !== interaction.guild.id || !panel.enabled) throw new Error("لوحة التذاكر هذه غير متاحة.");
          const existing = interaction.guild.channels.cache.find(channel => channel.type === ChannelType.GuildText && channel.topic === `majlsawi-ticket:${panel.id}:${interaction.user.id}`);
          if (existing) { await interaction.reply({ content: `لديك تذكرة مفتوحة بالفعل: ${existing}`, ephemeral: true }); return; }
          const channel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9-_]/g, "").slice(0, 32) || interaction.user.id}`,
            type: ChannelType.GuildText,
            parent: panel.categoryId ?? undefined,
            topic: `majlsawi-ticket:${panel.id}:${interaction.user.id}`,
            permissionOverwrites: [
              { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
              { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
              { id: panel.staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] },
            ],
            reason: `مجلساوي ticket panel #${panel.id}`,
          });
          const ticket = await createSupportTicket({ guildId: interaction.guild.id, panelId: panel.id, channelId: channel.id, openerId: interaction.user.id, openerLabel: interaction.user.username });
          const claimTicket = new ButtonBuilder().setCustomId(`ticket:claim:${ticket}`).setStyle(ButtonStyle.Primary).setLabel("مطالبة التذكرة").setEmoji("✋");
          const closeTicket = new ButtonBuilder().setCustomId(`ticket:close:${ticket}`).setStyle(ButtonStyle.Danger).setLabel("إغلاق التذكرة").setEmoji("🔒");
          await channel.send({ embeds: [new EmbedBuilder().setColor(0x5865f2).setAuthor({ name: "🎫 مجلساوي • SUPPORT TICKET" }).setTitle(`تذكرة #${ticket}`).setDescription(`مرحباً <@${interaction.user.id}>. اشرح طلبك هنا، وسيطلع عليه فريق الدعم.`).setFooter({ text: "إغلاق التذكرة لا يحفظ محتوى المحادثة." }).setTimestamp()], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(claimTicket, closeTicket)], allowedMentions: { users: [interaction.user.id] } });
          await interaction.reply({ content: `تم فتح تذكرتك: ${channel}`, ephemeral: true });
          await logDiscordEvent({ guild: interaction.guild, category: "tickets", eventKey: "ticket.opened", title: "Support ticket opened", accentColor: "#5865F2", icon: "🎫", actorId: interaction.user.id, actorLabel: interaction.user.username, targetId: String(ticket), targetLabel: `Ticket #${ticket}`, details: { "Channel": `<#${channel.id}>`, "Panel": `#${panel.id}`, "Content": "Not retained in log" } });
        } catch (error) { await interaction.reply({ content: `تعذر فتح التذكرة: ${error instanceof Error ? error.message : "خطأ غير معروف"}`, ephemeral: true }); }
      }
      if (interaction.isButton() && interaction.customId.startsWith("ticket:close:") && interaction.guild) {
        const ticketId = Number(interaction.customId.split(":")[2]);
        try {
          const ticket = await getSupportTicketById(ticketId);
          if (!ticket || ticket.guildId !== interaction.guild.id) throw new Error("هذه التذكرة غير موجودة أو لا تتبع هذا السيرفر.");
          const panel = await getTicketPanelById(ticket.panelId);
          const member = await interaction.guild.members.fetch(interaction.user.id);
          const isStaff = Boolean(panel?.staffRoleId && member.roles.cache.has(panel.staffRoleId));
          const closePlan = canCloseSupportTicket({ status: ticket.status, isStaff, hasManageChannels: member.permissions.has(PermissionFlagsBits.ManageChannels), isOpener: ticket.openerId === interaction.user.id });
          if (!closePlan.allowed) throw new Error(closePlan.reason === "already_closed" ? "هذه التذكرة مغلقة بالفعل." : "فقط صاحب التذكرة أو فريق الدعم يستطيع الإغلاق.");
          await closeSupportTicket({ id: ticket.id, closedById: interaction.user.id });
          const channel = await interaction.guild.channels.fetch(ticket.channelId).catch(() => null);
          if (channel?.isTextBased()) await channel.send({ embeds: [new EmbedBuilder().setColor(0x57f287).setAuthor({ name: "🔒 مجلساوي • TICKET CLOSED" }).setDescription(`أغلقت التذكرة بواسطة <@${interaction.user.id}>. لا يتم حفظ محتوى المحادثة تلقائياً.`).setTimestamp()], allowedMentions: { users: [interaction.user.id] } });
          await interaction.reply({ content: "تم إغلاق التذكرة وتسجيل حالتها. محتوى المحادثة لم يُحفظ.", ephemeral: true });
          await logDiscordEvent({ guild: interaction.guild, category: "tickets", eventKey: "ticket.closed", title: "Support ticket closed", accentColor: "#57F287", icon: "🔒", actorId: interaction.user.id, actorLabel: interaction.user.username, targetId: String(ticket.id), targetLabel: `Ticket #${ticket.id}`, details: { "Channel": `<#${ticket.channelId}>`, "Transcript": "Not stored" } });
        } catch (error) { await interaction.reply({ content: `تعذر إغلاق التذكرة: ${error instanceof Error ? error.message : "خطأ غير معروف"}`, ephemeral: true }); }
      }
      if (interaction.isButton() && interaction.customId.startsWith("ticket:claim:") && interaction.guild) {
        const ticketId = Number(interaction.customId.split(":")[2]);
        try {
          const ticket = await getSupportTicketById(ticketId);
          if (!ticket || ticket.guildId !== interaction.guild.id) throw new Error("هذه التذكرة غير موجودة أو لا تتبع هذا السيرفر.");
          const panel = await getTicketPanelById(ticket.panelId);
          const member = await interaction.guild.members.fetch(interaction.user.id);
          const isStaff = Boolean(panel?.staffRoleId && member.roles.cache.has(panel.staffRoleId));
          const plan = canClaimSupportTicket({ status: ticket.status, isStaff, hasManageChannels: member.permissions.has(PermissionFlagsBits.ManageChannels), isOpener: ticket.openerId === interaction.user.id });
          if (!plan.allowed) throw new Error(plan.reason === "not_open" ? "هذه التذكرة ليست متاحة للمطالبة." : "فقط فريق الدعم أو مدير القنوات يستطيع مطالبة التذكرة.");
          if (!await claimSupportTicket({ id: ticket.id, guildId: interaction.guild.id, claimedById: interaction.user.id })) throw new Error("تمت مطالبة التذكرة من عضو آخر أو أغلقت قبل إكمال الطلب.");
          await interaction.reply({ content: "تمت مطالبتك بالتذكرة. لا يتم حفظ محتوى المحادثة.", ephemeral: true });
          await logDiscordEvent({ guild: interaction.guild, category: "tickets", eventKey: "ticket.claimed", title: "Support ticket claimed", accentColor: "#5865F2", icon: "✋", actorId: interaction.user.id, actorLabel: interaction.user.username, targetId: String(ticket.id), targetLabel: `Ticket #${ticket.id}`, details: { "Channel": `<#${ticket.channelId}>`, "Content": "Not retained in log" } });
        } catch (error) { await interaction.reply({ content: `تعذر مطالبة التذكرة: ${error instanceof Error ? error.message : "خطأ غير معروف"}`, ephemeral: true }); }
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
