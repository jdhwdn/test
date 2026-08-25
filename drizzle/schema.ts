import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const logCategoryValues = [
  "moderation",
  "voice",
  "members",
  "roles",
  "channels",
  "messages",
  "xp",
  "welcome",
  "interactions",
  "system",
] as const;

export const guildSettings = mysqlTable("guild_settings", {
  guildId: varchar("guildId", { length: 32 }).primaryKey(),
  guildName: varchar("guildName", { length: 128 }).notNull(),
  botEnabled: boolean("botEnabled").default(true).notNull(),
  welcomeEnabled: boolean("welcomeEnabled").default(false).notNull(),
  welcomeChannelId: varchar("welcomeChannelId", { length: 32 }),
  welcomeMessage: text("welcomeMessage"),
  voiceConversationChannelId: varchar("voiceConversationChannelId", { length: 32 }),
  voiceConversationRoleId: varchar("voiceConversationRoleId", { length: 32 }),
  dashboardUrl: varchar("dashboardUrl", { length: 512 }),
  mutedRoleId: varchar("mutedRoleId", { length: 32 }),
  jailRoleId: varchar("jailRoleId", { length: 32 }),
  jailChannelId: varchar("jailChannelId", { length: 32 }),
  guardEnabled: boolean("guardEnabled").default(true).notNull(),
  guardWindowSeconds: int("guardWindowSeconds").default(60).notNull(),
  guardMaxRoleChanges: int("guardMaxRoleChanges").default(3).notNull(),
  guardMaxChannelChanges: int("guardMaxChannelChanges").default(3).notNull(),
  guardMaxBans: int("guardMaxBans").default(3).notNull(),
  warningLimit: int("warningLimit").default(3).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const logChannelRoutes = mysqlTable(
  "log_channel_routes",
  {
    id: int("id").autoincrement().primaryKey(),
    guildId: varchar("guildId", { length: 32 }).notNull(),
    category: mysqlEnum("category", logCategoryValues).notNull(),
    channelId: varchar("channelId", { length: 32 }).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("log_route_guild_category_idx").on(table.guildId, table.category),
  ],
);

export const activityLogs = mysqlTable(
  "activity_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    guildId: varchar("guildId", { length: 32 }).notNull(),
    category: mysqlEnum("category", logCategoryValues).notNull(),
    eventKey: varchar("eventKey", { length: 96 }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    accentColor: varchar("accentColor", { length: 12 }).notNull(),
    icon: varchar("icon", { length: 32 }).notNull(),
    actorId: varchar("actorId", { length: 32 }),
    actorLabel: varchar("actorLabel", { length: 128 }),
    targetId: varchar("targetId", { length: 32 }),
    targetLabel: varchar("targetLabel", { length: 128 }),
    reason: text("reason"),
    detailsJson: text("detailsJson").notNull(),
    destinationChannelId: varchar("destinationChannelId", { length: 32 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("activity_guild_created_idx").on(table.guildId, table.createdAt),
    index("activity_guild_category_idx").on(table.guildId, table.category),
  ],
);

export const moderationCases = mysqlTable(
  "moderation_cases",
  {
    id: int("id").autoincrement().primaryKey(),
    guildId: varchar("guildId", { length: 32 }).notNull(),
    action: mysqlEnum("action", [
      "ban",
      "kick",
      "mute",
      "unmute",
      "deafen",
      "undeafen",
      "warn",
      "jail",
      "unjail",
    ]).notNull(),
    executorId: varchar("executorId", { length: 32 }).notNull(),
    executorLabel: varchar("executorLabel", { length: 128 }).notNull(),
    memberId: varchar("memberId", { length: 32 }).notNull(),
    memberLabel: varchar("memberLabel", { length: 128 }).notNull(),
    reason: text("reason").notNull(),
    expiresAt: timestamp("expiresAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("moderation_guild_member_idx").on(table.guildId, table.memberId),
  ],
);

export const xpProfiles = mysqlTable(
  "xp_profiles",
  {
    id: int("id").autoincrement().primaryKey(),
    guildId: varchar("guildId", { length: 32 }).notNull(),
    memberId: varchar("memberId", { length: 32 }).notNull(),
    memberLabel: varchar("memberLabel", { length: 128 }).notNull(),
    xp: int("xp").default(0).notNull(),
    level: int("level").default(0).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("xp_guild_member_idx").on(table.guildId, table.memberId),
    index("xp_guild_rank_idx").on(table.guildId, table.xp),
  ],
);

export const commandRolePermissions = mysqlTable(
  "command_role_permissions",
  {
    id: int("id").autoincrement().primaryKey(),
    guildId: varchar("guildId", { length: 32 }).notNull(),
    commandKey: varchar("commandKey", { length: 48 }).notNull(),
    roleId: varchar("roleId", { length: 32 }).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("command_permission_guild_command_idx").on(table.guildId, table.commandKey),
  ],
);

export const botBlacklists = mysqlTable(
  "bot_blacklists",
  {
    id: int("id").autoincrement().primaryKey(),
    guildId: varchar("guildId", { length: 32 }).notNull(),
    memberId: varchar("memberId", { length: 32 }).notNull(),
    addedById: varchar("addedById", { length: 64 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("blacklist_guild_member_idx").on(table.guildId, table.memberId),
  ],
);

export const jailRecords = mysqlTable(
  "jail_records",
  {
    id: int("id").autoincrement().primaryKey(),
    guildId: varchar("guildId", { length: 32 }).notNull(),
    memberId: varchar("memberId", { length: 32 }).notNull(),
    memberLabel: varchar("memberLabel", { length: 128 }).notNull(),
    jailedById: varchar("jailedById", { length: 32 }).notNull(),
    jailedByLabel: varchar("jailedByLabel", { length: 128 }).notNull(),
    jailRoleId: varchar("jailRoleId", { length: 32 }).notNull(),
    jailChannelId: varchar("jailChannelId", { length: 32 }).notNull(),
    messageId: varchar("messageId", { length: 32 }),
    reason: text("reason").notNull(),
    rolesJson: text("rolesJson").notNull(),
    releasedAt: timestamp("releasedAt"),
    releasedById: varchar("releasedById", { length: 32 }),
    releasedByLabel: varchar("releasedByLabel", { length: 128 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("jail_guild_member_active_idx").on(table.guildId, table.memberId, table.releasedAt),
  ],
);

export type GuildSettings = typeof guildSettings.$inferSelect;
export type LogChannelRoute = typeof logChannelRoutes.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type ModerationCase = typeof moderationCases.$inferSelect;
export type XpProfile = typeof xpProfiles.$inferSelect;
export type CommandRolePermission = typeof commandRolePermissions.$inferSelect;
export type BotBlacklist = typeof botBlacklists.$inferSelect;
export type JailRecord = typeof jailRecords.$inferSelect;
