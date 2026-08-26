import { and, desc, eq, gte, isNotNull, isNull, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  activityLogs,
  autoModRules,
  botBlacklists,
  commandRolePermissions,
  communityEvents,
  communityKnowledgeItems,
  economyProfiles,
  economyTransactions,
  eventRsvps,
  giveawayEntries,
  giveaways,
  guildSettings,
  InsertUser,
  jailRecords,
  levelRoleRewards,
  logCategoryValues,
  logChannelRoutes,
  moderationCases,
  pollOptions,
  pollVotes,
  polls,
  roleShopItems,
  streamAnnouncementDeliveries,
  streamAnnouncements,
  suggestions,
  supportTickets,
  ticketPanels,
  users,
  warningRecords,
  xpProfiles,
} from "../drizzle/schema";
import { ENV } from './_core/env';

export type LogCategory = (typeof logCategoryValues)[number];

export type GuildSettingsInput = {
  guildId: string;
  guildName: string;
  botEnabled?: boolean;
  welcomeEnabled?: boolean;
  welcomeChannelId?: string | null;
  welcomeAutoRoleId?: string | null;
  memberCountChannelId?: string | null;
  welcomeMessage?: string | null;
  welcomeCardConfig?: string | null;
  voiceConversationChannelId?: string | null;
  voiceConversationRoleId?: string | null;
  dashboardUrl?: string | null;
  mutedRoleId?: string | null;
  jailRoleId?: string | null;
  jailChannelId?: string | null;
  guardEnabled?: boolean;
  guardWindowSeconds?: number;
  guardMaxRoleChanges?: number;
  guardMaxChannelChanges?: number;
  guardMaxBans?: number;
  warningLimit?: number;
  warningExpiryDays?: number;
  xpEnabled?: boolean;
  xpPerMessage?: number;
  xpCooldownSeconds?: number;
  xpAnnouncementChannelId?: string | null;
  xpLevelUpMessage?: string | null;
  antiSpamEnabled?: boolean;
  antiSpamMaxMessages?: number;
  antiSpamWindowSeconds?: number;
  antiLinkEnabled?: boolean;
  antiBotEnabled?: boolean;
  antiRaidEnabled?: boolean;
  antiRaidJoinLimit?: number;
  antiRaidWindowSeconds?: number;
  autoMuteMinutes?: number;
  autoKickEnabled?: boolean;
  autoCleanEnabled?: boolean;
  autoCleanMinutes?: number;
  moderatorReportChannelId?: string | null;
  aiEnabled?: boolean;
  aiRulesText?: string | null;
  aiTranslationEnabled?: boolean;
  aiTicketSummariesEnabled?: boolean;
};

export type StreamAnnouncementInput = {
  guildId: string;
  name: string;
  enabled: boolean;
  destinationChannelId: string;
  mentionRoleId?: string | null;
  sourceLabel: string;
  sourceUrl?: string | null;
  messageTemplate?: string | null;
  secretHash: string;
};

export type ModerationCommandKey = "ban" | "kick" | "mute" | "unmute" | "deafen" | "undeafen" | "warn" | "jail" | "unjail" | "xp" | "join" | "leave" | "say" | "release_jail" | "guard_bypass" | "giveaway" | "event" | "ticket" | "poll" | "suggestion" | "economy" | "community_manage";

export type SavedJailRole = {
  id: string;
  name: string;
};

export type ActivityLogInput = {
  guildId: string;
  category: LogCategory;
  eventKey: string;
  title: string;
  accentColor: string;
  icon: string;
  actorId?: string | null;
  actorLabel?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  reason?: string | null;
  details: Record<string, string>;
  destinationChannelId?: string | null;
};

export function selectEnabledLogRoute<T extends { category: LogCategory; enabled: boolean }>(
  routes: T[],
  category: LogCategory,
) {
  return routes.find(route => route.category === category && route.enabled);
}

let _db: ReturnType<typeof drizzle> | null = null;

/** Test-only dependency seam. Production code must use getDb and DATABASE_URL. */
export function setDbForTests(db: ReturnType<typeof drizzle> | null) {
  _db = db;
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export function requireDatabase<T>(db: T | null | undefined, operation: string): T {
  if (!db) {
    throw new Error(`قاعدة البيانات غير متاحة أثناء ${operation}. أضف DATABASE_URL صالحاً لخدمة MySQL في Railway ثم طبّق الترحيلات.`);
  }
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function listGuildSettings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(guildSettings).orderBy(guildSettings.guildName);
}

export async function getGuildSettings(guildId: string) {
  const db = requireDatabase(await getDb(), "قراءة إعدادات السيرفر");
  const [settings] = await db.select().from(guildSettings).where(eq(guildSettings.guildId, guildId)).limit(1);
  return settings;
}

export async function saveGuildSettings(input: GuildSettingsInput) {
  const db = requireDatabase(await getDb(), "حفظ إعدادات السيرفر");
  const existing = await getGuildSettings(input.guildId);
  const values = {
    guildId: input.guildId,
    guildName: input.guildName,
    botEnabled: input.botEnabled ?? existing?.botEnabled ?? true,
    welcomeEnabled: input.welcomeEnabled ?? existing?.welcomeEnabled ?? false,
    welcomeChannelId: input.welcomeChannelId ?? existing?.welcomeChannelId ?? null,
    welcomeMessage: input.welcomeMessage ?? existing?.welcomeMessage ?? null,
    welcomeCardConfig: input.welcomeCardConfig ?? existing?.welcomeCardConfig ?? null,
    voiceConversationChannelId: input.voiceConversationChannelId ?? existing?.voiceConversationChannelId ?? null,
    voiceConversationRoleId: input.voiceConversationRoleId ?? existing?.voiceConversationRoleId ?? null,
    dashboardUrl: input.dashboardUrl ?? existing?.dashboardUrl ?? null,
    mutedRoleId: input.mutedRoleId ?? existing?.mutedRoleId ?? null,
    jailRoleId: input.jailRoleId ?? existing?.jailRoleId ?? null,
    jailChannelId: input.jailChannelId ?? existing?.jailChannelId ?? null,
    guardEnabled: input.guardEnabled ?? existing?.guardEnabled ?? true,
    guardWindowSeconds: input.guardWindowSeconds ?? existing?.guardWindowSeconds ?? 60,
    guardMaxRoleChanges: input.guardMaxRoleChanges ?? existing?.guardMaxRoleChanges ?? 3,
    guardMaxChannelChanges: input.guardMaxChannelChanges ?? existing?.guardMaxChannelChanges ?? 3,
    guardMaxBans: input.guardMaxBans ?? existing?.guardMaxBans ?? 3,
    warningLimit: input.warningLimit ?? existing?.warningLimit ?? 3,
    warningExpiryDays: input.warningExpiryDays ?? existing?.warningExpiryDays ?? 30,
    xpEnabled: input.xpEnabled ?? existing?.xpEnabled ?? true,
    xpPerMessage: input.xpPerMessage ?? existing?.xpPerMessage ?? 15,
    xpCooldownSeconds: input.xpCooldownSeconds ?? existing?.xpCooldownSeconds ?? 60,
    xpAnnouncementChannelId: input.xpAnnouncementChannelId ?? existing?.xpAnnouncementChannelId ?? null,
    xpLevelUpMessage: input.xpLevelUpMessage ?? existing?.xpLevelUpMessage ?? null,
    antiSpamEnabled: input.antiSpamEnabled ?? existing?.antiSpamEnabled ?? false,
    antiSpamMaxMessages: input.antiSpamMaxMessages ?? existing?.antiSpamMaxMessages ?? 6,
    antiSpamWindowSeconds: input.antiSpamWindowSeconds ?? existing?.antiSpamWindowSeconds ?? 10,
    antiLinkEnabled: input.antiLinkEnabled ?? existing?.antiLinkEnabled ?? false,
    antiBotEnabled: input.antiBotEnabled ?? existing?.antiBotEnabled ?? false,
    antiRaidEnabled: input.antiRaidEnabled ?? existing?.antiRaidEnabled ?? false,
    antiRaidJoinLimit: input.antiRaidJoinLimit ?? existing?.antiRaidJoinLimit ?? 8,
    antiRaidWindowSeconds: input.antiRaidWindowSeconds ?? existing?.antiRaidWindowSeconds ?? 60,
    autoMuteMinutes: input.autoMuteMinutes ?? existing?.autoMuteMinutes ?? 10,
    autoKickEnabled: input.autoKickEnabled ?? existing?.autoKickEnabled ?? false,
    autoCleanEnabled: input.autoCleanEnabled ?? existing?.autoCleanEnabled ?? false,
    autoCleanMinutes: input.autoCleanMinutes ?? existing?.autoCleanMinutes ?? 60,
    moderatorReportChannelId: input.moderatorReportChannelId ?? existing?.moderatorReportChannelId ?? null,
    aiEnabled: input.aiEnabled ?? existing?.aiEnabled ?? false,
    aiRulesText: input.aiRulesText ?? existing?.aiRulesText ?? null,
    aiTranslationEnabled: input.aiTranslationEnabled ?? existing?.aiTranslationEnabled ?? false,
    aiTicketSummariesEnabled: input.aiTicketSummariesEnabled ?? existing?.aiTicketSummariesEnabled ?? false,
  };
  await db.insert(guildSettings).values(values).onDuplicateKeyUpdate({
    set: { ...values, updatedAt: new Date() },
  });
}

export async function listStreamAnnouncements(guildId: string) {
  const db = requireDatabase(await getDb(), "قراءة إعلانات البث");
  return db.select().from(streamAnnouncements).where(eq(streamAnnouncements.guildId, guildId)).orderBy(desc(streamAnnouncements.updatedAt));
}

export async function listCommunityKnowledgeItems(guildId: string) {
  const db = requireDatabase(await getDb(), "قراءة معرفة المجتمع");
  return db.select().from(communityKnowledgeItems).where(eq(communityKnowledgeItems.guildId, guildId)).orderBy(desc(communityKnowledgeItems.createdAt));
}

export async function createCommunityKnowledgeItem(input: { guildId: string; kind: "rule" | "faq"; title: string; content: string; enabled: boolean }) {
  const db = requireDatabase(await getDb(), "إضافة معرفة المجتمع");
  const result = await db.insert(communityKnowledgeItems).values(input);
  return Number(result[0].insertId);
}

export async function deleteCommunityKnowledgeItem(guildId: string, id: number) {
  const db = requireDatabase(await getDb(), "حذف معرفة المجتمع");
  await db.delete(communityKnowledgeItems).where(and(eq(communityKnowledgeItems.guildId, guildId), eq(communityKnowledgeItems.id, id)));
}

export async function getStreamAnnouncementById(id: number) {
  const db = requireDatabase(await getDb(), "قراءة إعلان البث");
  const [entry] = await db.select().from(streamAnnouncements).where(eq(streamAnnouncements.id, id)).limit(1);
  return entry;
}

export async function createStreamAnnouncement(input: StreamAnnouncementInput) {
  const db = requireDatabase(await getDb(), "إنشاء إعلان البث");
  const result = await db.insert(streamAnnouncements).values(input);
  return Number(result[0].insertId);
}

export async function updateStreamAnnouncement(id: number, input: StreamAnnouncementInput) {
  const db = requireDatabase(await getDb(), "تحديث إعلان البث");
  await db.update(streamAnnouncements).set({ ...input, updatedAt: new Date() }).where(eq(streamAnnouncements.id, id));
}

export async function deleteStreamAnnouncement(guildId: string, id: number) {
  const db = requireDatabase(await getDb(), "حذف إعداد إعلان البث");
  await db.delete(streamAnnouncements).where(and(eq(streamAnnouncements.id, id), eq(streamAnnouncements.guildId, guildId)));
}

export async function claimStreamAnnouncementDelivery(input: { announcementId: number; eventKeyHash: string }) {
  const db = requireDatabase(await getDb(), "منع تكرار إعلان البث");
  try {
    await db.insert(streamAnnouncementDeliveries).values(input);
    return true;
  } catch (error) {
    if (error instanceof Error && /duplicate|ER_DUP_ENTRY/i.test(error.message)) return false;
    throw error;
  }
}

export async function releaseStreamAnnouncementDelivery(input: { announcementId: number; eventKeyHash: string }) {
  const db = requireDatabase(await getDb(), "إعادة محاولة إعلان البث");
  await db.delete(streamAnnouncementDeliveries).where(and(eq(streamAnnouncementDeliveries.announcementId, input.announcementId), eq(streamAnnouncementDeliveries.eventKeyHash, input.eventKeyHash)));
}

export async function listLogRoutes(guildId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(logChannelRoutes).where(eq(logChannelRoutes.guildId, guildId));
}

export async function getLogRoute(guildId: string, category: LogCategory) {
  const db = await getDb();
  if (!db) return undefined;
  const [route] = await db
    .select()
    .from(logChannelRoutes)
    .where(and(eq(logChannelRoutes.guildId, guildId), eq(logChannelRoutes.category, category)))
    .limit(1);
  return route && selectEnabledLogRoute([route], category) ? route : undefined;
}

export async function saveLogRoute(input: {
  guildId: string;
  category: LogCategory;
  channelId: string;
  enabled: boolean;
}) {
  const db = await getDb();
  if (!db) return;
  const routes = await listLogRoutes(input.guildId);
  const existing = routes.find(route => route.category === input.category);
  if (existing) {
    await db
      .update(logChannelRoutes)
      .set({ channelId: input.channelId, enabled: input.enabled, updatedAt: new Date() })
      .where(eq(logChannelRoutes.id, existing.id));
    return;
  }
  await db.insert(logChannelRoutes).values(input);
}

export async function createActivityLog(input: ActivityLogInput) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLogs).values({
    guildId: input.guildId,
    category: input.category,
    eventKey: input.eventKey,
    title: input.title,
    accentColor: input.accentColor,
    icon: input.icon,
    actorId: input.actorId ?? null,
    actorLabel: input.actorLabel ?? null,
    targetId: input.targetId ?? null,
    targetLabel: input.targetLabel ?? null,
    reason: input.reason ?? null,
    detailsJson: JSON.stringify(input.details),
    destinationChannelId: input.destinationChannelId ?? null,
  });
}

export async function getRecentActivity(guildId?: string, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  const boundedLimit = Math.min(Math.max(limit, 1), 100);
  if (guildId) {
    return db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.guildId, guildId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(boundedLimit);
  }
  return db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(boundedLimit);
}

export async function recordModerationCase(input: {
  guildId: string;
  action: "ban" | "kick" | "mute" | "unmute" | "deafen" | "undeafen" | "warn" | "jail" | "unjail";
  executorId: string;
  executorLabel: string;
  memberId: string;
  memberLabel: string;
  reason: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(moderationCases).values(input);
}

export async function listModerationCasesSince(guildId: string, since: Date) {
  const db = requireDatabase(await getDb(), "قراءة تقرير نشاط المشرفين");
  return db.select().from(moderationCases).where(and(eq(moderationCases.guildId, guildId), gte(moderationCases.createdAt, since))).orderBy(desc(moderationCases.createdAt)).limit(500);
}

export async function listModerationCaseHistory(input: { guildId: string; limit?: number }) {
  const db = requireDatabase(await getDb(), "قراءة تاريخ الإشراف");
  const safeLimit = Math.min(20, Math.max(1, Math.floor(input.limit ?? 10)));
  return db.select({ action: moderationCases.action, executorLabel: moderationCases.executorLabel, memberLabel: moderationCases.memberLabel, createdAt: moderationCases.createdAt })
    .from(moderationCases).where(eq(moderationCases.guildId, input.guildId)).orderBy(desc(moderationCases.createdAt)).limit(safeLimit);
}

export async function listCommandRolePermissions(guildId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(commandRolePermissions).where(eq(commandRolePermissions.guildId, guildId));
}

export async function getCommandRoleIds(guildId: string, commandKey: ModerationCommandKey) {
  const permissions = await listCommandRolePermissions(guildId);
  return permissions.filter(permission => permission.commandKey === commandKey).map(permission => permission.roleId);
}

export async function saveCommandRolePermission(input: {
  guildId: string;
  commandKey: ModerationCommandKey;
  roleId: string;
}) {
  const db = await getDb();
  if (!db) return;
  const permissions = await listCommandRolePermissions(input.guildId);
  const existing = permissions.find(permission => permission.commandKey === input.commandKey);
  if (existing) {
    await db.update(commandRolePermissions).set({ roleId: input.roleId, updatedAt: new Date() }).where(eq(commandRolePermissions.id, existing.id));
    return;
  }
  await db.insert(commandRolePermissions).values(input);
}

export async function clearCommandRolePermission(guildId: string, commandKey: ModerationCommandKey) {
  const db = await getDb();
  if (!db) return;
  const permissions = await listCommandRolePermissions(guildId);
  const matching = permissions.filter(permission => permission.commandKey === commandKey);
  await Promise.all(matching.map(permission => db.delete(commandRolePermissions).where(eq(commandRolePermissions.id, permission.id))));
}

export function isValidDiscordUserId(value: string) {
  return /^\d{17,20}$/.test(value.trim());
}

export async function listBlacklistedMembers(guildId: string) {
  const db = requireDatabase(await getDb(), "قراءة البلاك ليست");
  return db.select().from(botBlacklists).where(eq(botBlacklists.guildId, guildId)).orderBy(desc(botBlacklists.createdAt));
}

export async function isBlacklistedMember(guildId: string, memberId: string) {
  const db = await getDb();
  if (!db) return false;
  const [entry] = await db
    .select({ id: botBlacklists.id })
    .from(botBlacklists)
    .where(and(eq(botBlacklists.guildId, guildId), eq(botBlacklists.memberId, memberId)))
    .limit(1);
  return Boolean(entry);
}

export type BlacklistAddOutcome = "added" | "already_exists" | "unavailable_database";

export function resolveBlacklistAddOutcome(alreadyExists: boolean, databaseAvailable = true): BlacklistAddOutcome {
  if (!databaseAvailable) return "unavailable_database";
  return alreadyExists ? "already_exists" : "added";
}

export async function addBlacklistedMember(input: { guildId: string; memberId: string; addedById: string }) {
  if (!isValidDiscordUserId(input.memberId)) throw new Error("Discord User ID must contain 17 to 20 digits.");
  const memberId = input.memberId.trim();
  const db = await getDb();
  if (!db) return { outcome: resolveBlacklistAddOutcome(false, false), memberId };
  if (await isBlacklistedMember(input.guildId, memberId)) return { outcome: resolveBlacklistAddOutcome(true), memberId };
  await db.insert(botBlacklists).values({ guildId: input.guildId, memberId, addedById: input.addedById });
  return { outcome: resolveBlacklistAddOutcome(false), memberId };
}

export async function removeBlacklistedMember(guildId: string, memberId: string) {
  const db = requireDatabase(await getDb(), "إزالة عضو من البلاك ليست");
  const [entry] = await db
    .select({ id: botBlacklists.id })
    .from(botBlacklists)
    .where(and(eq(botBlacklists.guildId, guildId), eq(botBlacklists.memberId, memberId)))
    .limit(1);
  if (!entry) return false;
  await db.delete(botBlacklists).where(eq(botBlacklists.id, entry.id));
  return true;
}

export async function createJailRecord(input: {
  guildId: string;
  memberId: string;
  memberLabel: string;
  jailedById: string;
  jailedByLabel: string;
  jailRoleId: string;
  jailChannelId: string;
  reason: string;
  roles: SavedJailRole[];
}) {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(jailRecords).values({
    guildId: input.guildId,
    memberId: input.memberId,
    memberLabel: input.memberLabel,
    jailedById: input.jailedById,
    jailedByLabel: input.jailedByLabel,
    jailRoleId: input.jailRoleId,
    jailChannelId: input.jailChannelId,
    reason: input.reason,
    rolesJson: JSON.stringify(input.roles),
  });
  return getActiveJailRecord(input.guildId, input.memberId);
}

export async function getActiveJailRecord(guildId: string, memberId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [record] = await db
    .select()
    .from(jailRecords)
    .where(and(eq(jailRecords.guildId, guildId), eq(jailRecords.memberId, memberId), isNull(jailRecords.releasedAt)))
    .orderBy(desc(jailRecords.createdAt))
    .limit(1);
  return record;
}

export async function getActiveJailRecordById(recordId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [record] = await db
    .select()
    .from(jailRecords)
    .where(and(eq(jailRecords.id, recordId), isNull(jailRecords.releasedAt)))
    .limit(1);
  return record;
}

export async function saveJailMessageId(recordId: number, messageId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(jailRecords).set({ messageId }).where(eq(jailRecords.id, recordId));
}

export async function releaseJailRecord(input: {
  recordId: number;
  releasedById: string;
  releasedByLabel: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.update(jailRecords).set({
    releasedAt: new Date(),
    releasedById: input.releasedById,
    releasedByLabel: input.releasedByLabel,
  }).where(and(eq(jailRecords.id, input.recordId), isNull(jailRecords.releasedAt)));
}

export function parseJailRoles(rolesJson: string): SavedJailRole[] {
  try {
    const roles = JSON.parse(rolesJson) as SavedJailRole[];
    return Array.isArray(roles) ? roles.filter(role => typeof role.id === "string" && typeof role.name === "string") : [];
  } catch {
    return [];
  }
}

export async function adjustMemberXp(input: {
  guildId: string;
  memberId: string;
  memberLabel: string;
  delta: number;
}) {
  const db = await getDb();
  if (!db) return { xp: 0, level: 0, levelChanged: false };
  const [profile] = await db
    .select()
    .from(xpProfiles)
    .where(and(eq(xpProfiles.guildId, input.guildId), eq(xpProfiles.memberId, input.memberId)))
    .limit(1);
  const current = profile;
  const currentXp = current?.xp ?? 0;
  const nextXp = Math.max(0, currentXp + input.delta);
  const nextLevel = levelForXp(nextXp);
  if (current) {
    await db
      .update(xpProfiles)
      .set({ xp: nextXp, level: nextLevel, memberLabel: input.memberLabel, updatedAt: new Date() })
      .where(eq(xpProfiles.id, current.id));
  } else {
    await db.insert(xpProfiles).values({
      guildId: input.guildId,
      memberId: input.memberId,
      memberLabel: input.memberLabel,
      xp: nextXp,
      level: nextLevel,
    });
  }
  return { xp: nextXp, level: nextLevel, levelChanged: current ? current.level !== nextLevel : nextLevel > 0 };
}

export function levelForXp(xp: number) {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100));
}

export async function getMemberLevel(guildId: string, memberId: string) {
  const db = requireDatabase(await getDb(), "قراءة مستوى العضو");
  const [profile] = await db.select({ level: xpProfiles.level }).from(xpProfiles).where(and(eq(xpProfiles.guildId, guildId), eq(xpProfiles.memberId, memberId))).limit(1);
  return profile?.level ?? 0;
}

export async function getMemberXpProfile(guildId: string, memberId: string) {
  const db = requireDatabase(await getDb(), "قراءة تقدم XP للعضو");
  const [profile] = await db.select({ xp: xpProfiles.xp, level: xpProfiles.level }).from(xpProfiles).where(and(eq(xpProfiles.guildId, guildId), eq(xpProfiles.memberId, memberId))).limit(1);
  return profile ?? { xp: 0, level: 0 };
}

export async function listXpLeaderboard(guildId: string, limit = 10) {
  const db = requireDatabase(await getDb(), "قراءة صدارة XP");
  const safeLimit = Math.min(10, Math.max(1, Math.floor(limit)));
  return db.select({ memberLabel: xpProfiles.memberLabel, xp: xpProfiles.xp, level: xpProfiles.level })
    .from(xpProfiles)
    .where(eq(xpProfiles.guildId, guildId))
    .orderBy(desc(xpProfiles.xp), desc(xpProfiles.updatedAt))
    .limit(safeLimit);
}

export function xpRequiredForLevel(level: number) {
  return Math.max(0, level) ** 2 * 100;
}

export async function listLevelRoleRewards(guildId: string) {
  const db = requireDatabase(await getDb(), "قراءة رتب المستويات");
  return db.select().from(levelRoleRewards).where(eq(levelRoleRewards.guildId, guildId)).orderBy(levelRoleRewards.level);
}

export async function saveLevelRoleReward(input: { guildId: string; level: number; roleId: string; announce: boolean }) {
  const db = requireDatabase(await getDb(), "حفظ رتبة مستوى");
  const existing = await db.select().from(levelRoleRewards).where(and(eq(levelRoleRewards.guildId, input.guildId), eq(levelRoleRewards.level, input.level))).limit(1);
  if (existing[0]) {
    await db.update(levelRoleRewards).set({ roleId: input.roleId, announce: input.announce }).where(eq(levelRoleRewards.id, existing[0].id));
    return existing[0].id;
  }
  const result = await db.insert(levelRoleRewards).values(input);
  return Number(result[0].insertId);
}

export async function removeLevelRoleReward(guildId: string, id: number) {
  const db = requireDatabase(await getDb(), "حذف رتبة مستوى");
  await db.delete(levelRoleRewards).where(and(eq(levelRoleRewards.guildId, guildId), eq(levelRoleRewards.id, id)));
}

export async function createWarningRecord(input: { guildId: string; memberId: string; memberLabel: string; moderatorId: string; moderatorLabel: string; reason: string; expiresAt?: Date | null }) {
  const db = requireDatabase(await getDb(), "حفظ التحذير");
  await db.insert(warningRecords).values({ ...input, expiresAt: input.expiresAt ?? null });
}

export async function countActiveWarnings(guildId: string, memberId: string) {
  const db = requireDatabase(await getDb(), "عد التحذيرات");
  const records = await db.select().from(warningRecords).where(and(eq(warningRecords.guildId, guildId), eq(warningRecords.memberId, memberId), isNull(warningRecords.resolvedAt)));
  const now = Date.now();
  return records.filter(record => !record.expiresAt || record.expiresAt.getTime() > now).length;
}

export async function listActiveWarnings(input: { guildId: string; memberId: string; limit?: number }) {
  const db = requireDatabase(await getDb(), "قراءة التحذيرات النشطة");
  const safeLimit = Math.min(10, Math.max(1, Math.floor(input.limit ?? 10)));
  const records = await db.select({ id: warningRecords.id, moderatorLabel: warningRecords.moderatorLabel, reason: warningRecords.reason, createdAt: warningRecords.createdAt, expiresAt: warningRecords.expiresAt })
    .from(warningRecords)
    .where(and(eq(warningRecords.guildId, input.guildId), eq(warningRecords.memberId, input.memberId), isNull(warningRecords.resolvedAt)))
    .orderBy(desc(warningRecords.createdAt))
    .limit(safeLimit);
  const now = Date.now();
  return records.filter(record => !record.expiresAt || record.expiresAt.getTime() > now);
}

export async function resolveWarningRecord(input: { guildId: string; memberId: string; id: number }) {
  const db = requireDatabase(await getDb(), "حل التحذير");
  const [record] = await db.select({ id: warningRecords.id }).from(warningRecords)
    .where(and(eq(warningRecords.id, input.id), eq(warningRecords.guildId, input.guildId), eq(warningRecords.memberId, input.memberId), isNull(warningRecords.resolvedAt)))
    .limit(1);
  if (!record) return false;
  await db.update(warningRecords).set({ resolvedAt: new Date() }).where(eq(warningRecords.id, record.id));
  return true;
}

export async function saveWarningAppeal(input: { guildId: string; memberId: string; id: number; note: string }) {
  const db = requireDatabase(await getDb(), "حفظ طعن التحذير");
  const result = await db.update(warningRecords).set({ appealNote: input.note, appealSubmittedAt: new Date() })
    .where(and(
      eq(warningRecords.id, input.id),
      eq(warningRecords.guildId, input.guildId),
      eq(warningRecords.memberId, input.memberId),
      isNotNull(warningRecords.resolvedAt),
      isNull(warningRecords.appealSubmittedAt),
    ));
  return result[0].affectedRows > 0;
}

export async function listAutoModRules(guildId: string) {
  const db = requireDatabase(await getDb(), "قراءة قواعد AutoMod");
  return db.select().from(autoModRules).where(eq(autoModRules.guildId, guildId)).orderBy(desc(autoModRules.updatedAt));
}

export async function saveAutoModRule(input: { guildId: string; name: string; type: "keyword" | "invite" | "caps" | "flood"; pattern?: string | null; action: "delete" | "warn" | "mute" | "kick"; exemptRoleId?: string | null; enabled: boolean }) {
  const db = requireDatabase(await getDb(), "حفظ قاعدة AutoMod");
  const result = await db.insert(autoModRules).values({ ...input, pattern: input.pattern ?? null, exemptRoleId: input.exemptRoleId ?? null });
  return Number(result[0].insertId);
}

export async function removeAutoModRule(guildId: string, id: number) {
  const db = requireDatabase(await getDb(), "حذف قاعدة AutoMod");
  await db.delete(autoModRules).where(and(eq(autoModRules.guildId, guildId), eq(autoModRules.id, id)));
}

export async function createSuggestion(input: { guildId: string; channelId: string; authorId: string; content: string; anonymous: boolean }) {
  const db = requireDatabase(await getDb(), "حفظ اقتراح");
  const result = await db.insert(suggestions).values(input);
  return Number(result[0].insertId);
}

export async function saveSuggestionMessageId(input: { guildId: string; id: number; messageId: string }) {
  const db = requireDatabase(await getDb(), "حفظ رسالة الاقتراح");
  await db.update(suggestions).set({ messageId: input.messageId }).where(and(eq(suggestions.id, input.id), eq(suggestions.guildId, input.guildId)));
}

export async function getSuggestionById(id: number) {
  const db = requireDatabase(await getDb(), "قراءة الاقتراح");
  const [suggestion] = await db.select().from(suggestions).where(eq(suggestions.id, id)).limit(1);
  return suggestion;
}

export async function updateSuggestionStatus(input: { guildId: string; id: number; status: "accepted" | "declined" | "implemented" }) {
  const db = requireDatabase(await getDb(), "تحديث حالة الاقتراح");
  const result = await db.update(suggestions).set({ status: input.status }).where(and(eq(suggestions.id, input.id), eq(suggestions.guildId, input.guildId), eq(suggestions.status, "open")));
  return Number(result[0].affectedRows) > 0;
}

export async function listSuggestions(guildId: string) {
  const db = requireDatabase(await getDb(), "قراءة الاقتراحات");
  return db.select().from(suggestions).where(eq(suggestions.guildId, guildId)).orderBy(desc(suggestions.createdAt));
}

export async function createCommunityEvent(input: { guildId: string; channelId: string; title: string; description: string; startsAt: Date; reminderMinutes: number; createdById: string }) {
  const db = requireDatabase(await getDb(), "إنشاء فعالية");
  const result = await db.insert(communityEvents).values(input);
  return Number(result[0].insertId);
}

export async function listCommunityEvents(guildId: string) {
  const db = requireDatabase(await getDb(), "قراءة الفعاليات");
  return db.select().from(communityEvents).where(eq(communityEvents.guildId, guildId)).orderBy(communityEvents.startsAt);
}

export async function getCommunityEventById(id: number) {
  const db = requireDatabase(await getDb(), "قراءة الفعالية");
  const [event] = await db.select().from(communityEvents).where(eq(communityEvents.id, id)).limit(1);
  return event;
}

export async function closeCommunityEvent(input: { guildId: string; id: number }) {
  const db = requireDatabase(await getDb(), "إغلاق الفعالية");
  const result = await db.update(communityEvents).set({ status: "completed" }).where(and(eq(communityEvents.id, input.id), eq(communityEvents.guildId, input.guildId), eq(communityEvents.status, "scheduled")));
  return Number(result[0].affectedRows) > 0;
}

export async function setEventRsvp(input: { eventId: number; memberId: string; state: "going" | "maybe" | "declined" }) {
  const db = requireDatabase(await getDb(), "تحديث حضور الفعالية");
  const existing = await db.select().from(eventRsvps).where(and(eq(eventRsvps.eventId, input.eventId), eq(eventRsvps.memberId, input.memberId))).limit(1);
  if (existing[0]) await db.update(eventRsvps).set({ state: input.state }).where(eq(eventRsvps.id, existing[0].id));
  else await db.insert(eventRsvps).values(input);
}

export async function getEventRsvpSummary(eventId: number) {
  const db = requireDatabase(await getDb(), "قراءة ملخص حضور الفعالية");
  const rows = await db.select({ state: eventRsvps.state }).from(eventRsvps).where(eq(eventRsvps.eventId, eventId));
  const totals = new Map<"going" | "maybe" | "declined", number>();
  for (const row of rows) totals.set(row.state, (totals.get(row.state) ?? 0) + 1);
  return (["going", "maybe", "declined"] as const).map(state => ({ state, total: totals.get(state) ?? 0 }));
}

export async function createGiveaway(input: { guildId: string; channelId: string; prize: string; winnerCount: number; requiredRoleId?: string | null; minimumLevel: number; endsAt: Date; createdById: string }) {
  const db = requireDatabase(await getDb(), "إنشاء سحب");
  const result = await db.insert(giveaways).values({ ...input, requiredRoleId: input.requiredRoleId ?? null });
  return Number(result[0].insertId);
}

export async function listGiveaways(guildId: string) {
  const db = requireDatabase(await getDb(), "قراءة السحوبات");
  return db.select().from(giveaways).where(eq(giveaways.guildId, guildId)).orderBy(desc(giveaways.createdAt));
}

export async function enterGiveaway(input: { giveawayId: number; memberId: string }) {
  const db = requireDatabase(await getDb(), "تسجيل دخول السحب");
  const existing = await db.select().from(giveawayEntries).where(and(eq(giveawayEntries.giveawayId, input.giveawayId), eq(giveawayEntries.memberId, input.memberId))).limit(1);
  if (!existing[0]) await db.insert(giveawayEntries).values(input);
  return !existing[0];
}

export async function getGiveawayById(id: number) {
  const db = requireDatabase(await getDb(), "قراءة السحب");
  const [giveaway] = await db.select().from(giveaways).where(eq(giveaways.id, id)).limit(1);
  return giveaway;
}

export async function listGiveawayEntries(giveawayId: number) {
  const db = requireDatabase(await getDb(), "قراءة مشاركي السحب");
  return db.select().from(giveawayEntries).where(eq(giveawayEntries.giveawayId, giveawayId));
}

export async function finishGiveaway(input: { id: number; winnerIds: string[] }) {
  const db = requireDatabase(await getDb(), "إنهاء السحب");
  await db.update(giveaways).set({ status: "ended" }).where(and(eq(giveaways.id, input.id), eq(giveaways.status, "active")));
  return input.winnerIds;
}

export async function createTicketPanel(input: { guildId: string; channelId: string; categoryId?: string | null; staffRoleId: string; title: string; description: string }) {
  const db = requireDatabase(await getDb(), "إنشاء لوحة تذاكر");
  const result = await db.insert(ticketPanels).values({ ...input, categoryId: input.categoryId ?? null });
  return Number(result[0].insertId);
}

export async function listTicketPanels(guildId: string) {
  const db = requireDatabase(await getDb(), "قراءة لوحات التذاكر");
  return db.select().from(ticketPanels).where(eq(ticketPanels.guildId, guildId)).orderBy(desc(ticketPanels.createdAt));
}

export async function getTicketPanelById(id: number) {
  const db = requireDatabase(await getDb(), "قراءة لوحة التذكرة");
  const [panel] = await db.select().from(ticketPanels).where(eq(ticketPanels.id, id)).limit(1);
  return panel;
}

export async function createSupportTicket(input: { guildId: string; panelId: number; channelId: string; openerId: string; openerLabel: string }) {
  const db = requireDatabase(await getDb(), "فتح تذكرة");
  const result = await db.insert(supportTickets).values(input);
  return Number(result[0].insertId);
}

export async function listSupportTickets(guildId: string) {
  const db = requireDatabase(await getDb(), "قراءة التذاكر");
  return db.select().from(supportTickets).where(eq(supportTickets.guildId, guildId)).orderBy(desc(supportTickets.createdAt));
}

export async function getSupportTicketById(id: number) {
  const db = requireDatabase(await getDb(), "قراءة تذكرة الدعم");
  const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1);
  return ticket;
}

export async function getSupportTicketByGuildId(input: { guildId: string; id: number }) {
  const db = requireDatabase(await getDb(), "قراءة تذكرة الدعم في السيرفر");
  const [ticket] = await db.select().from(supportTickets).where(and(eq(supportTickets.id, input.id), eq(supportTickets.guildId, input.guildId))).limit(1);
  return ticket;
}

export async function saveSupportTicketSummaryMetadata(input: { guildId: string; id: number; metadata: string | null }) {
  const db = requireDatabase(await getDb(), "حفظ ملاحظات تلخيص التذكرة");
  await db.update(supportTickets).set({ staffSummaryMetadata: input.metadata }).where(and(eq(supportTickets.id, input.id), eq(supportTickets.guildId, input.guildId)));
}

export async function claimSupportTicket(input: { id: number; guildId: string; claimedById: string }) {
  const db = requireDatabase(await getDb(), "مطالبة تذكرة الدعم");
  const result = await db.update(supportTickets).set({ status: "claimed", claimedById: input.claimedById }).where(and(eq(supportTickets.id, input.id), eq(supportTickets.guildId, input.guildId), eq(supportTickets.status, "open")));
  return Number(result[0].affectedRows) > 0;
}

export async function closeSupportTicket(input: { id: number; closedById: string }) {
  const db = requireDatabase(await getDb(), "إغلاق التذكرة");
  await db.update(supportTickets).set({ status: "closed", closedById: input.closedById, closedAt: new Date() }).where(and(eq(supportTickets.id, input.id), or(eq(supportTickets.status, "open"), eq(supportTickets.status, "claimed"))));
}

export async function createPoll(input: { guildId: string; channelId: string; question: string; anonymous: boolean; endsAt?: Date | null; createdById: string; options: string[] }) {
  const db = requireDatabase(await getDb(), "إنشاء تصويت");
  const result = await db.insert(polls).values({ guildId: input.guildId, channelId: input.channelId, question: input.question, anonymous: input.anonymous, endsAt: input.endsAt ?? null, createdById: input.createdById });
  const pollId = Number(result[0].insertId);
  await db.insert(pollOptions).values(input.options.map((label, position) => ({ pollId, label, position })));
  return pollId;
}

export async function listPolls(guildId: string) {
  const db = requireDatabase(await getDb(), "قراءة التصويتات");
  return db.select().from(polls).where(eq(polls.guildId, guildId)).orderBy(desc(polls.createdAt));
}

export async function getPollById(id: number) {
  const db = requireDatabase(await getDb(), "قراءة التصويت");
  const [poll] = await db.select().from(polls).where(eq(polls.id, id)).limit(1);
  return poll;
}

export async function closePoll(input: { guildId: string; id: number }) {
  const db = requireDatabase(await getDb(), "إغلاق التصويت");
  const result = await db.update(polls).set({ status: "closed" }).where(and(eq(polls.id, input.id), eq(polls.guildId, input.guildId), eq(polls.status, "active")));
  return Number(result[0].affectedRows) > 0;
}

export async function listPollOptions(pollId: number) {
  const db = requireDatabase(await getDb(), "قراءة خيارات التصويت");
  return db.select().from(pollOptions).where(eq(pollOptions.pollId, pollId)).orderBy(pollOptions.position);
}

export async function listPollResults(pollId: number) {
  const db = requireDatabase(await getDb(), "قراءة نتائج التصويت");
  const [options, votes] = await Promise.all([
    db.select().from(pollOptions).where(eq(pollOptions.pollId, pollId)).orderBy(pollOptions.position),
    db.select({ optionId: pollVotes.optionId }).from(pollVotes).where(eq(pollVotes.pollId, pollId)),
  ]);
  const counts = new Map<number, number>();
  for (const vote of votes) counts.set(vote.optionId, (counts.get(vote.optionId) ?? 0) + 1);
  return options.map(option => ({ id: option.id, label: option.label, position: option.position, votes: counts.get(option.id) ?? 0 }));
}

export async function votePoll(input: { pollId: number; optionId: number; memberId: string }) {
  const db = requireDatabase(await getDb(), "حفظ التصويت");
  const existing = await db.select().from(pollVotes).where(and(eq(pollVotes.pollId, input.pollId), eq(pollVotes.memberId, input.memberId))).limit(1);
  if (existing[0]) await db.update(pollVotes).set({ optionId: input.optionId }).where(eq(pollVotes.id, existing[0].id));
  else await db.insert(pollVotes).values(input);
}

export async function getEconomyProfile(guildId: string, memberId: string) {
  const db = requireDatabase(await getDb(), "قراءة اقتصاد العضو");
  const [profile] = await db.select().from(economyProfiles).where(and(eq(economyProfiles.guildId, guildId), eq(economyProfiles.memberId, memberId))).limit(1);
  if (profile) return profile;
  await db.insert(economyProfiles).values({ guildId, memberId });
  const [created] = await db.select().from(economyProfiles).where(and(eq(economyProfiles.guildId, guildId), eq(economyProfiles.memberId, memberId))).limit(1);
  return created!;
}

export async function adjustEconomyBalance(input: { guildId: string; memberId: string; amount: number; kind: "admin" | "transfer" | "reward" | "shop" | "game"; reason: string; counterpartyId?: string | null }) {
  const db = requireDatabase(await getDb(), "تحديث اقتصاد العضو");
  const profile = await getEconomyProfile(input.guildId, input.memberId);
  const balance = profile.balance + input.amount;
  if (balance < 0) throw new Error("الرصيد غير كافٍ لهذه العملية.");
  await db.update(economyProfiles).set({ balance }).where(eq(economyProfiles.id, profile.id));
  await db.insert(economyTransactions).values({ ...input, counterpartyId: input.counterpartyId ?? null });
  return balance;
}

export async function listEconomyTransactionHistory(input: { guildId: string; memberId: string; limit?: number }) {
  const db = requireDatabase(await getDb(), "قراءة سجل الاقتصاد");
  const safeLimit = Math.min(15, Math.max(1, Math.floor(input.limit ?? 10)));
  return db.select({ amount: economyTransactions.amount, kind: economyTransactions.kind, createdAt: economyTransactions.createdAt })
    .from(economyTransactions).where(and(eq(economyTransactions.guildId, input.guildId), eq(economyTransactions.memberId, input.memberId)))
    .orderBy(desc(economyTransactions.createdAt)).limit(safeLimit);
}

export async function adjustMemberReputation(input: { guildId: string; memberId: string; delta: number }) {
  const db = requireDatabase(await getDb(), "تحديث سمعة العضو");
  const profile = await getEconomyProfile(input.guildId, input.memberId);
  const reputation = Math.max(0, profile.reputation + input.delta);
  await db.update(economyProfiles).set({ reputation }).where(eq(economyProfiles.id, profile.id));
  return reputation;
}

export async function listRoleShopItems(guildId: string) {
  const db = requireDatabase(await getDb(), "قراءة متجر الرتب");
  return db.select().from(roleShopItems).where(eq(roleShopItems.guildId, guildId)).orderBy(roleShopItems.cost);
}

export async function saveRoleShopItem(input: { guildId: string; roleId: string; name: string; cost: number; enabled: boolean }) {
  const db = requireDatabase(await getDb(), "حفظ عنصر متجر الرتب");
  const existing = await db.select().from(roleShopItems).where(and(eq(roleShopItems.guildId, input.guildId), eq(roleShopItems.roleId, input.roleId))).limit(1);
  if (existing[0]) { await db.update(roleShopItems).set({ name: input.name, cost: input.cost, enabled: input.enabled }).where(eq(roleShopItems.id, existing[0].id)); return existing[0].id; }
  const result = await db.insert(roleShopItems).values(input);
  return Number(result[0].insertId);
}

export async function getRoleShopItemById(id: number) {
  const db = requireDatabase(await getDb(), "قراءة عنصر متجر الرتب");
  const [item] = await db.select().from(roleShopItems).where(eq(roleShopItems.id, id)).limit(1);
  return item;
}
