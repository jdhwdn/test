import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { logCategoryValues } from "../drizzle/schema";
import {
  addBlacklistedMember,
  clearCommandRolePermission,
  createCommunityEvent,
  createCommunityKnowledgeItem,
  createGiveaway,
  createPoll,
  createSuggestion,
  createStreamAnnouncement,
  createTicketPanel,
  deleteStreamAnnouncement,
  deleteCommunityKnowledgeItem,
  getGuildSettings,
  getStreamAnnouncementById,
  getRecentActivity,
  listAutoModRules,
  listBlacklistedMembers,
  listCommunityEvents,
  listCommunityKnowledgeItems,
  listCommandRolePermissions,
  listGiveaways,
  listGuildSettings,
  listLevelRoleRewards,
  listLogRoutes,
  listXpLeaderboard,
  listPolls,
  listRoleShopItems,
  listStreamAnnouncements,
  listSuggestions,
  listSupportTickets,
  listTicketPanels,
  removeAutoModRule,
  saveCommandRolePermission,
  saveAutoModRule,
  saveGuildSettings,
  saveLevelRoleReward,
  saveLogRoute,
  saveRoleShopItem,
  saveSupportTicketSummaryMetadata,
  updateStreamAnnouncement,
  removeLevelRoleReward,
  removeBlacklistedMember,
} from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { createDashboardSession, DASHBOARD_SESSION_COOKIE, dashboardAdminUser, validateDashboardPassword } from "./dashboardAuth";
import { getDiscordStatus, listConnectedGuilds, listGuildRoles, listGuildTextChannels, listGuildTicketCategories, listGuildVoiceChannels, logBlacklistAdministration, sendStreamAnnouncement, sendWelcomeCardPreview } from "./discord/bot";
import { getVoiceFeatureReadiness } from "./discord/tts";
import { stringifyWelcomeCardConfig } from "./discord/welcomeCardConfig";
import { isValidTicketCategorySelection } from "./discord/ticketCategoryRules";
import { createStreamWebhookSecret, hashStreamWebhookSecret } from "./streamAnnouncementRules";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";

const logCategorySchema = z.enum(logCategoryValues);
const permissionCommandKeys = ["ban", "kick", "mute", "unmute", "deafen", "undeafen", "warn", "jail", "unjail", "xp", "join", "leave", "say", "release_jail", "guard_bypass", "giveaway", "event", "ticket", "poll", "suggestion", "economy", "community_manage"] as const;
const permissionCommandSchema = z.enum(permissionCommandKeys);

export function nullableDashboardSettings<T>(settings: T | undefined): T | null {
  return settings ?? null;
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    login: publicProcedure.input(z.object({ password: z.string().min(1).max(512) })).mutation(async ({ input, ctx }) => {
      if (!validateDashboardPassword(input.password)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "كلمة مرور لوحة التحكم غير صحيحة." });
      }
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(DASHBOARD_SESSION_COOKIE, await createDashboardSession(), {
        ...cookieOptions,
        sameSite: "lax",
        maxAge: 12 * 60 * 60 * 1000,
      });
      return dashboardAdminUser();
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      ctx.res.clearCookie(DASHBOARD_SESSION_COOKIE, { ...cookieOptions, sameSite: "lax", maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  dashboard: router({
    status: adminProcedure.query(async () => ({
      bot: getDiscordStatus(),
      voice: getVoiceFeatureReadiness(),
      guilds: listConnectedGuilds(),
      configuredGuilds: await listGuildSettings(),
    })),
    channels: adminProcedure.input(z.object({ guildId: z.string().min(1) })).query(async ({ input }) => listGuildTextChannels(input.guildId)),
    ticketCategories: adminProcedure.input(z.object({ guildId: z.string().min(1) })).query(async ({ input }) => listGuildTicketCategories(input.guildId)),
    voiceChannels: adminProcedure.input(z.object({ guildId: z.string().min(1) })).query(async ({ input }) => listGuildVoiceChannels(input.guildId)),
    roles: adminProcedure.input(z.object({ guildId: z.string().min(1) })).query(({ input }) => listGuildRoles(input.guildId)),
  }),
  settings: router({
    get: adminProcedure.input(z.object({ guildId: z.string().min(1) })).query(async ({ input }) => nullableDashboardSettings(await getGuildSettings(input.guildId))),
    save: adminProcedure.input(z.object({
      guildId: z.string().min(1),
      guildName: z.string().min(1).max(128),
      botEnabled: z.boolean().optional(),
      welcomeEnabled: z.boolean().optional(),
      welcomeChannelId: z.string().max(32).nullable().optional(),
      welcomeAutoRoleId: z.string().max(32).nullable().optional(),
      memberCountChannelId: z.string().max(32).nullable().optional(),
      welcomeMessage: z.string().max(1800).nullable().optional(),
      welcomeCardConfig: z.string().max(8000).nullable().optional(),
      voiceConversationChannelId: z.string().max(32).nullable().optional(),
      voiceConversationRoleId: z.string().max(32).nullable().optional(),
      dashboardUrl: z.string().url().max(512).nullable().optional(),
      mutedRoleId: z.string().max(32).nullable().optional(),
      jailRoleId: z.string().max(32).nullable().optional(),
      jailChannelId: z.string().max(32).nullable().optional(),
      guardEnabled: z.boolean().optional(),
      guardWindowSeconds: z.number().int().min(10).max(3600).optional(),
      guardMaxRoleChanges: z.number().int().min(1).max(100).optional(),
      guardMaxChannelChanges: z.number().int().min(1).max(100).optional(),
      guardMaxBans: z.number().int().min(1).max(100).optional(),
      warningLimit: z.number().int().min(1).max(20).optional(),
      warningExpiryDays: z.number().int().min(1).max(365).optional(),
      xpEnabled: z.boolean().optional(),
      xpPerMessage: z.number().int().min(1).max(500).optional(),
      xpCooldownSeconds: z.number().int().min(5).max(3600).optional(),
      xpAnnouncementChannelId: z.string().max(32).nullable().optional(),
      xpLevelUpMessage: z.string().max(500).nullable().optional(),
      antiSpamEnabled: z.boolean().optional(),
      antiSpamMaxMessages: z.number().int().min(2).max(100).optional(),
      antiSpamWindowSeconds: z.number().int().min(3).max(600).optional(),
      antiLinkEnabled: z.boolean().optional(),
      antiBotEnabled: z.boolean().optional(),
      antiRaidEnabled: z.boolean().optional(),
      antiRaidJoinLimit: z.number().int().min(2).max(100).optional(),
      antiRaidWindowSeconds: z.number().int().min(10).max(3600).optional(),
      autoMuteMinutes: z.number().int().min(1).max(10080).optional(),
      autoKickEnabled: z.boolean().optional(),
      autoCleanEnabled: z.boolean().optional(),
      autoCleanMinutes: z.number().int().min(5).max(10080).optional(),
      moderatorReportChannelId: z.string().max(32).nullable().optional(),
      aiEnabled: z.boolean().optional(),
      aiRulesText: z.string().max(12000).nullable().optional(),
      aiTranslationEnabled: z.boolean().optional(),
      aiTicketSummariesEnabled: z.boolean().optional(),
    })).mutation(async ({ input }) => {
      if (input.voiceConversationChannelId) {
        const voiceChannels = await listGuildVoiceChannels(input.guildId);
        if (!voiceChannels.some(channel => channel.id === input.voiceConversationChannelId)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "اختر روم صوتي يمكن لمجلساوي رؤيته والاتصال والتحدث فيه." });
        }
      }
      if (input.welcomeAutoRoleId) {
        const roles = await listGuildRoles(input.guildId);
        if (!roles.some(role => role.id === input.welcomeAutoRoleId)) throw new TRPCError({ code: "BAD_REQUEST", message: "اختر رتبة موجودة في السيرفر لرتبة الترحيب." });
      }
      if (input.memberCountChannelId) {
        const channels = await listGuildTextChannels(input.guildId);
        if (!channels.some(channel => channel.id === input.memberCountChannelId)) throw new TRPCError({ code: "BAD_REQUEST", message: "اختر قناة نصية موجودة لعداد الأعضاء." });
      }
      await saveGuildSettings({ ...input, welcomeCardConfig: input.welcomeCardConfig === undefined ? undefined : stringifyWelcomeCardConfig(input.welcomeCardConfig) });
      return { success: true };
    }),
  }),
  xp: router({
    rewards: adminProcedure.input(z.object({ guildId: z.string().min(1) })).query(({ input }) => listLevelRoleRewards(input.guildId)),
    leaderboard: adminProcedure.input(z.object({ guildId: z.string().min(1) })).query(({ input }) => listXpLeaderboard(input.guildId)),
    saveReward: adminProcedure.input(z.object({ guildId: z.string().min(1), level: z.number().int().min(1).max(10000), roleId: z.string().min(1).max(32), announce: z.boolean().default(true) })).mutation(async ({ input }) => ({ id: await saveLevelRoleReward(input) })),
    removeReward: adminProcedure.input(z.object({ guildId: z.string().min(1), id: z.number().int().positive() })).mutation(async ({ input }) => { await removeLevelRoleReward(input.guildId, input.id); return { success: true }; }),
  }),
  automod: router({
    list: adminProcedure.input(z.object({ guildId: z.string().min(1) })).query(({ input }) => listAutoModRules(input.guildId)),
    create: adminProcedure.input(z.object({ guildId: z.string().min(1), name: z.string().min(2).max(96), type: z.enum(["keyword", "invite", "caps", "flood"]), pattern: z.string().max(500).nullable().optional(), action: z.enum(["delete", "warn", "mute", "kick"]), exemptRoleId: z.string().max(32).nullable().optional(), enabled: z.boolean().default(true) })).mutation(async ({ input }) => ({ id: await saveAutoModRule(input) })),
    remove: adminProcedure.input(z.object({ guildId: z.string().min(1), id: z.number().int().positive() })).mutation(async ({ input }) => { await removeAutoModRule(input.guildId, input.id); return { success: true }; }),
  }),
  community: router({
    knowledge: adminProcedure.input(z.object({ guildId: z.string().min(1) })).query(({ input }) => listCommunityKnowledgeItems(input.guildId)),
    suggestions: adminProcedure.input(z.object({ guildId: z.string().min(1) })).query(({ input }) => listSuggestions(input.guildId)),
    events: adminProcedure.input(z.object({ guildId: z.string().min(1) })).query(({ input }) => listCommunityEvents(input.guildId)),
    giveaways: adminProcedure.input(z.object({ guildId: z.string().min(1) })).query(({ input }) => listGiveaways(input.guildId)),
    polls: adminProcedure.input(z.object({ guildId: z.string().min(1) })).query(({ input }) => listPolls(input.guildId)),
    ticketPanels: adminProcedure.input(z.object({ guildId: z.string().min(1) })).query(({ input }) => listTicketPanels(input.guildId)),
    tickets: adminProcedure.input(z.object({ guildId: z.string().min(1) })).query(({ input }) => listSupportTickets(input.guildId)),
    saveTicketSummaryMetadata: adminProcedure.input(z.object({ guildId: z.string().min(1), id: z.number().int().positive(), metadata: z.string().max(1800).nullable().optional() })).mutation(async ({ input }) => { await saveSupportTicketSummaryMetadata({ guildId: input.guildId, id: input.id, metadata: input.metadata?.trim() || null }); return { success: true }; }),
    roleShop: adminProcedure.input(z.object({ guildId: z.string().min(1) })).query(({ input }) => listRoleShopItems(input.guildId)),
    saveRoleShopItem: adminProcedure.input(z.object({ guildId: z.string().min(1), roleId: z.string().min(1).max(32), name: z.string().min(1).max(128), cost: z.number().int().min(1).max(1_000_000), enabled: z.boolean().default(true) })).mutation(async ({ input }) => ({ id: await saveRoleShopItem(input) })),
    createKnowledge: adminProcedure.input(z.object({ guildId: z.string().min(1), kind: z.enum(["rule", "faq"]), title: z.string().min(2).max(160), content: z.string().min(2).max(4000), enabled: z.boolean().default(true) })).mutation(async ({ input }) => ({ id: await createCommunityKnowledgeItem(input) })),
    deleteKnowledge: adminProcedure.input(z.object({ guildId: z.string().min(1), id: z.number().int().positive() })).mutation(async ({ input }) => { await deleteCommunityKnowledgeItem(input.guildId, input.id); return { success: true }; }),
    createSuggestion: adminProcedure.input(z.object({ guildId: z.string().min(1), channelId: z.string().min(1).max(32), content: z.string().min(3).max(2000), anonymous: z.boolean().default(false) })).mutation(async ({ input, ctx }) => ({ id: await createSuggestion({ ...input, authorId: String(ctx.user.id) }) })),
    createEvent: adminProcedure.input(z.object({ guildId: z.string().min(1), channelId: z.string().min(1).max(32), title: z.string().min(3).max(160), description: z.string().min(1).max(4000), startsAt: z.date(), reminderMinutes: z.number().int().min(0).max(10080).default(30) })).mutation(async ({ input, ctx }) => ({ id: await createCommunityEvent({ ...input, createdById: String(ctx.user.id) }) })),
    createGiveaway: adminProcedure.input(z.object({ guildId: z.string().min(1), channelId: z.string().min(1).max(32), prize: z.string().min(2).max(256), winnerCount: z.number().int().min(1).max(20), requiredRoleId: z.string().max(32).nullable().optional(), minimumLevel: z.number().int().min(0).max(10000).default(0), endsAt: z.date() })).mutation(async ({ input, ctx }) => ({ id: await createGiveaway({ ...input, requiredRoleId: input.requiredRoleId ?? null, createdById: String(ctx.user.id) }) })),
    createPoll: adminProcedure.input(z.object({ guildId: z.string().min(1), channelId: z.string().min(1).max(32), question: z.string().min(3).max(256), anonymous: z.boolean().default(false), endsAt: z.date().nullable().optional(), options: z.array(z.string().min(1).max(128)).min(2).max(8) })).mutation(async ({ input, ctx }) => ({ id: await createPoll({ ...input, endsAt: input.endsAt ?? null, createdById: String(ctx.user.id) }) })),
    createTicketPanel: adminProcedure.input(z.object({ guildId: z.string().min(1), channelId: z.string().min(1).max(32), categoryId: z.string().max(32).nullable().optional(), staffRoleId: z.string().min(1).max(32), title: z.string().min(2).max(128), description: z.string().min(1).max(2000) })).mutation(async ({ input }) => {
      if (input.categoryId) {
        const categories = await listGuildTicketCategories(input.guildId);
        if (!isValidTicketCategorySelection(categories.map(category => category.id), input.categoryId)) throw new TRPCError({ code: "BAD_REQUEST", message: "اختر فئة تذاكر يمكن لمجلساوي رؤيتها وإدارة القنوات تحتها." });
      }
      return { id: await createTicketPanel({ ...input, categoryId: input.categoryId ?? null }) };
    }),
  }),
  welcome: router({
    sendPreview: adminProcedure.input(z.object({ guildId: z.string().min(1) })).mutation(async ({ input }) => sendWelcomeCardPreview(input.guildId)),
  }),
  streams: router({
    list: adminProcedure.input(z.object({ guildId: z.string().min(1) })).query(({ input }) => listStreamAnnouncements(input.guildId)),
    create: adminProcedure.input(z.object({ guildId: z.string().min(1), name: z.string().min(2).max(96), enabled: z.boolean().default(true), destinationChannelId: z.string().min(1).max(32), mentionRoleId: z.string().max(32).nullable().optional(), sourceLabel: z.string().min(2).max(80), sourceUrl: z.string().url().max(1024).refine(value => value.startsWith("https://"), "رابط المصدر يجب أن يبدأ بـ https://").nullable().optional(), messageTemplate: z.string().max(1800).nullable().optional() })).mutation(async ({ input }) => {
      const secret = createStreamWebhookSecret();
      const id = await createStreamAnnouncement({ ...input, mentionRoleId: input.mentionRoleId ?? null, sourceUrl: input.sourceUrl ?? null, messageTemplate: input.messageTemplate ?? null, secretHash: hashStreamWebhookSecret(secret) });
      return { id, secret };
    }),
    update: adminProcedure.input(z.object({ id: z.number().int().positive(), guildId: z.string().min(1), name: z.string().min(2).max(96), enabled: z.boolean(), destinationChannelId: z.string().min(1).max(32), mentionRoleId: z.string().max(32).nullable().optional(), sourceLabel: z.string().min(2).max(80), sourceUrl: z.string().url().max(1024).refine(value => value.startsWith("https://"), "رابط المصدر يجب أن يبدأ بـ https://").nullable().optional(), messageTemplate: z.string().max(1800).nullable().optional(), rotateSecret: z.boolean().default(false) })).mutation(async ({ input }) => {
      const existing = await getStreamAnnouncementById(input.id);
      if (!existing || existing.guildId !== input.guildId) throw new TRPCError({ code: "NOT_FOUND", message: "إعداد إعلان البث غير موجود." });
      const secret = input.rotateSecret ? createStreamWebhookSecret() : null;
      await updateStreamAnnouncement(input.id, { guildId: input.guildId, name: input.name, enabled: input.enabled, destinationChannelId: input.destinationChannelId, mentionRoleId: input.mentionRoleId ?? null, sourceLabel: input.sourceLabel, sourceUrl: input.sourceUrl ?? null, messageTemplate: input.messageTemplate ?? null, secretHash: secret ? hashStreamWebhookSecret(secret) : existing.secretHash });
      return { success: true, secret };
    }),
    delete: adminProcedure.input(z.object({ guildId: z.string().min(1), id: z.number().int().positive() })).mutation(async ({ input }) => { await deleteStreamAnnouncement(input.guildId, input.id); return { success: true }; }),
    sendTest: adminProcedure.input(z.object({ guildId: z.string().min(1), id: z.number().int().positive() })).mutation(async ({ input }) => {
      const entry = await getStreamAnnouncementById(input.id);
      if (!entry || entry.guildId !== input.guildId) throw new TRPCError({ code: "NOT_FOUND", message: "إعداد إعلان البث غير موجود." });
      await sendStreamAnnouncement({ guildId: entry.guildId, destinationChannelId: entry.destinationChannelId, mentionRoleId: entry.mentionRoleId, sourceLabel: entry.sourceLabel, sourceUrl: entry.sourceUrl, messageTemplate: entry.messageTemplate, title: `تجربة إعلان ${entry.name}`, streamUrl: entry.sourceUrl || "https://example.com/live" });
      return { success: true };
    }),
  }),
  permissions: router({
    list: adminProcedure.input(z.object({ guildId: z.string().min(1) })).query(({ input }) => listCommandRolePermissions(input.guildId)),
    save: adminProcedure.input(z.object({
      guildId: z.string().min(1),
      commandKey: permissionCommandSchema,
      roleId: z.string().min(1).max(32),
    })).mutation(async ({ input }) => {
      await saveCommandRolePermission(input);
      return { success: true };
    }),
    clear: adminProcedure.input(z.object({
      guildId: z.string().min(1),
      commandKey: permissionCommandSchema,
    })).mutation(async ({ input }) => {
      await clearCommandRolePermission(input.guildId, input.commandKey);
      return { success: true };
    }),
  }),
  blacklist: router({
    list: adminProcedure.input(z.object({ guildId: z.string().min(1) })).query(({ input }) => listBlacklistedMembers(input.guildId)),
    add: adminProcedure.input(z.object({
      guildId: z.string().min(1),
      memberId: z.string().regex(/^\d{17,20}$/, "أدخل Discord User ID صحيحاً من 17 إلى 20 رقماً."),
    })).mutation(async ({ input, ctx }) => {
      const result = await addBlacklistedMember({ guildId: input.guildId, memberId: input.memberId, addedById: String(ctx.user.id) });
      if (result.outcome === "unavailable_database") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن حفظ البلاك ليست: أضف DATABASE_URL لخدمة MySQL في Railway وطبّق الترحيلات أولاً." });
      }
      if (result.outcome === "added") await logBlacklistAdministration({ guildId: input.guildId, memberId: result.memberId, actorId: String(ctx.user.id), actorLabel: ctx.user.name ?? "لوحة مجلساوي", action: "added" });
      return { success: true, added: result.outcome === "added", outcome: result.outcome };
    }),
    remove: adminProcedure.input(z.object({
      guildId: z.string().min(1),
      memberId: z.string().regex(/^\d{17,20}$/, "Discord User ID غير صحيح."),
    })).mutation(async ({ input, ctx }) => {
      const removed = await removeBlacklistedMember(input.guildId, input.memberId);
      if (removed) await logBlacklistAdministration({ guildId: input.guildId, memberId: input.memberId, actorId: String(ctx.user.id), actorLabel: ctx.user.name ?? "لوحة مجلساوي", action: "removed" });
      return { success: removed };
    }),
  }),
  logging: router({
    routes: adminProcedure.input(z.object({ guildId: z.string().min(1) })).query(({ input }) => listLogRoutes(input.guildId)),
    saveRoute: adminProcedure.input(z.object({
      guildId: z.string().min(1),
      category: logCategorySchema,
      channelId: z.string().min(1).max(32),
      enabled: z.boolean(),
    })).mutation(async ({ input }) => {
      await saveLogRoute(input);
      return { success: true };
    }),
  }),
  activity: router({
    recent: adminProcedure.input(z.object({
      guildId: z.string().min(1).optional(),
      limit: z.number().int().min(1).max(100).default(30),
    })).query(({ input }) => getRecentActivity(input.guildId, input.limit)),
  }),
});

export type AppRouter = typeof appRouter;
