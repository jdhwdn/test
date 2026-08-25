import { and, desc, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  activityLogs,
  botBlacklists,
  commandRolePermissions,
  guildSettings,
  InsertUser,
  jailRecords,
  logCategoryValues,
  logChannelRoutes,
  moderationCases,
  users,
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
  welcomeMessage?: string | null;
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
};

export type ModerationCommandKey = "ban" | "kick" | "mute" | "unmute" | "deafen" | "undeafen" | "warn" | "jail" | "unjail" | "xp" | "join" | "leave" | "say" | "release_jail" | "guard_bypass";

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
  };
  await db.insert(guildSettings).values(values).onDuplicateKeyUpdate({
    set: { ...values, updatedAt: new Date() },
  });
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
  const nextLevel = Math.floor(Math.sqrt(nextXp / 100));
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
