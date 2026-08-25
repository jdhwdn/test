import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { logCategoryValues } from "../drizzle/schema";
import {
  addBlacklistedMember,
  clearCommandRolePermission,
  getGuildSettings,
  getRecentActivity,
  listBlacklistedMembers,
  listCommandRolePermissions,
  listGuildSettings,
  listLogRoutes,
  saveCommandRolePermission,
  saveGuildSettings,
  saveLogRoute,
  removeBlacklistedMember,
} from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { createDashboardSession, DASHBOARD_SESSION_COOKIE, dashboardAdminUser, validateDashboardPassword } from "./dashboardAuth";
import { getDiscordStatus, listConnectedGuilds, listGuildRoles, listGuildTextChannels, listGuildVoiceChannels, logBlacklistAdministration, sendWelcomeCardPreview } from "./discord/bot";
import { getVoiceFeatureReadiness } from "./discord/tts";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";

const logCategorySchema = z.enum(logCategoryValues);
const permissionCommandKeys = ["ban", "kick", "mute", "unmute", "deafen", "undeafen", "warn", "jail", "unjail", "xp", "join", "leave", "say", "release_jail", "guard_bypass"] as const;
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
      welcomeMessage: z.string().max(1800).nullable().optional(),
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
    })).mutation(async ({ input }) => {
      if (input.voiceConversationChannelId) {
        const voiceChannels = await listGuildVoiceChannels(input.guildId);
        if (!voiceChannels.some(channel => channel.id === input.voiceConversationChannelId)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "اختر روم صوتي يمكن لمجلساوي رؤيته والاتصال والتحدث فيه." });
        }
      }
      await saveGuildSettings(input);
      return { success: true };
    }),
  }),
  welcome: router({
    sendPreview: adminProcedure.input(z.object({ guildId: z.string().min(1) })).mutation(async ({ input }) => sendWelcomeCardPreview(input.guildId)),
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
