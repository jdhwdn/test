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
  "community",
  "tickets",
  "economy",
  "ai",
] as const;

export const guildSettings = mysqlTable("guild_settings", {
  guildId: varchar("guildId", { length: 32 }).primaryKey(),
  guildName: varchar("guildName", { length: 128 }).notNull(),
  botEnabled: boolean("botEnabled").default(true).notNull(),
    welcomeEnabled: boolean("welcomeEnabled").default(false).notNull(),
    welcomeChannelId: varchar("welcomeChannelId", { length: 32 }),
    welcomeAutoRoleId: varchar("welcomeAutoRoleId", { length: 32 }),
    memberCountChannelId: varchar("memberCountChannelId", { length: 32 }),
    welcomeMessage: text("welcomeMessage"),
  welcomeCardConfig: text("welcomeCardConfig"),
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
  warningExpiryDays: int("warningExpiryDays").default(30).notNull(),
  xpEnabled: boolean("xpEnabled").default(true).notNull(),
  xpPerMessage: int("xpPerMessage").default(15).notNull(),
  xpCooldownSeconds: int("xpCooldownSeconds").default(60).notNull(),
  xpAnnouncementChannelId: varchar("xpAnnouncementChannelId", { length: 32 }),
  xpLevelUpMessage: text("xpLevelUpMessage"),
  antiSpamEnabled: boolean("antiSpamEnabled").default(false).notNull(),
  antiSpamMaxMessages: int("antiSpamMaxMessages").default(6).notNull(),
  antiSpamWindowSeconds: int("antiSpamWindowSeconds").default(10).notNull(),
  antiLinkEnabled: boolean("antiLinkEnabled").default(false).notNull(),
  antiBotEnabled: boolean("antiBotEnabled").default(false).notNull(),
  antiRaidEnabled: boolean("antiRaidEnabled").default(false).notNull(),
  antiRaidJoinLimit: int("antiRaidJoinLimit").default(8).notNull(),
  antiRaidWindowSeconds: int("antiRaidWindowSeconds").default(60).notNull(),
  autoMuteMinutes: int("autoMuteMinutes").default(10).notNull(),
  autoKickEnabled: boolean("autoKickEnabled").default(false).notNull(),
  autoCleanEnabled: boolean("autoCleanEnabled").default(false).notNull(),
  autoCleanMinutes: int("autoCleanMinutes").default(60).notNull(),
  moderatorReportChannelId: varchar("moderatorReportChannelId", { length: 32 }),
  aiEnabled: boolean("aiEnabled").default(false).notNull(),
  aiRulesText: text("aiRulesText"),
  aiTranslationEnabled: boolean("aiTranslationEnabled").default(false).notNull(),
  aiTicketSummariesEnabled: boolean("aiTicketSummariesEnabled").default(false).notNull(),
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

export const levelRoleRewards = mysqlTable(
  "level_role_rewards",
  {
    id: int("id").autoincrement().primaryKey(),
    guildId: varchar("guildId", { length: 32 }).notNull(),
    level: int("level").notNull(),
    roleId: varchar("roleId", { length: 32 }).notNull(),
    announce: boolean("announce").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("level_reward_guild_level_idx").on(table.guildId, table.level),
  ],
);

export const warningRecords = mysqlTable(
  "warning_records",
  {
    id: int("id").autoincrement().primaryKey(),
    guildId: varchar("guildId", { length: 32 }).notNull(),
    memberId: varchar("memberId", { length: 32 }).notNull(),
    memberLabel: varchar("memberLabel", { length: 128 }).notNull(),
    moderatorId: varchar("moderatorId", { length: 32 }).notNull(),
    moderatorLabel: varchar("moderatorLabel", { length: 128 }).notNull(),
    reason: text("reason").notNull(),
    appealNote: varchar("appealNote", { length: 600 }),
    appealSubmittedAt: timestamp("appealSubmittedAt"),
    expiresAt: timestamp("expiresAt"),
    resolvedAt: timestamp("resolvedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("warning_guild_member_idx").on(table.guildId, table.memberId, table.createdAt)],
);

export const autoModRules = mysqlTable(
  "automod_rules",
  {
    id: int("id").autoincrement().primaryKey(),
    guildId: varchar("guildId", { length: 32 }).notNull(),
    name: varchar("name", { length: 96 }).notNull(),
    type: mysqlEnum("type", ["keyword", "invite", "caps", "flood"]).notNull(),
    pattern: text("pattern"),
    action: mysqlEnum("action", ["delete", "warn", "mute", "kick"]).default("delete").notNull(),
    exemptRoleId: varchar("exemptRoleId", { length: 32 }),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("automod_guild_enabled_idx").on(table.guildId, table.enabled)],
);

export const ticketPanels = mysqlTable(
  "ticket_panels",
  {
    id: int("id").autoincrement().primaryKey(),
    guildId: varchar("guildId", { length: 32 }).notNull(),
    channelId: varchar("channelId", { length: 32 }).notNull(),
    messageId: varchar("messageId", { length: 32 }),
    categoryId: varchar("categoryId", { length: 32 }),
    staffRoleId: varchar("staffRoleId", { length: 32 }).notNull(),
    title: varchar("title", { length: 128 }).notNull(),
    description: text("description").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("ticket_panel_guild_idx").on(table.guildId)],
);

export const communityKnowledgeItems = mysqlTable(
  "community_knowledge_items",
  {
    id: int("id").autoincrement().primaryKey(),
    guildId: varchar("guildId", { length: 32 }).notNull(),
    kind: mysqlEnum("kind", ["rule", "faq"]).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    content: text("content").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("knowledge_guild_kind_enabled_idx").on(table.guildId, table.kind, table.enabled)],
);

export const supportTickets = mysqlTable(
  "support_tickets",
  {
    id: int("id").autoincrement().primaryKey(),
    guildId: varchar("guildId", { length: 32 }).notNull(),
    panelId: int("panelId").notNull(),
    channelId: varchar("channelId", { length: 32 }).notNull(),
    openerId: varchar("openerId", { length: 32 }).notNull(),
    openerLabel: varchar("openerLabel", { length: 128 }).notNull(),
    status: mysqlEnum("status", ["open", "claimed", "closed"]).default("open").notNull(),
    claimedById: varchar("claimedById", { length: 32 }),
    staffSummaryMetadata: text("staffSummaryMetadata"),
    closedById: varchar("closedById", { length: 32 }),
    closedAt: timestamp("closedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("ticket_guild_status_idx").on(table.guildId, table.status)],
);

export const giveaways = mysqlTable(
  "giveaways",
  {
    id: int("id").autoincrement().primaryKey(),
    guildId: varchar("guildId", { length: 32 }).notNull(),
    channelId: varchar("channelId", { length: 32 }).notNull(),
    messageId: varchar("messageId", { length: 32 }),
    prize: varchar("prize", { length: 256 }).notNull(),
    winnerCount: int("winnerCount").default(1).notNull(),
    requiredRoleId: varchar("requiredRoleId", { length: 32 }),
    minimumLevel: int("minimumLevel").default(0).notNull(),
    endsAt: timestamp("endsAt").notNull(),
    status: mysqlEnum("status", ["active", "ended", "cancelled"]).default("active").notNull(),
    createdById: varchar("createdById", { length: 32 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("giveaway_guild_status_ends_idx").on(table.guildId, table.status, table.endsAt)],
);

export const giveawayEntries = mysqlTable(
  "giveaway_entries",
  {
    id: int("id").autoincrement().primaryKey(),
    giveawayId: int("giveawayId").notNull(),
    memberId: varchar("memberId", { length: 32 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("giveaway_entry_member_idx").on(table.giveawayId, table.memberId)],
);

export const communityEvents = mysqlTable(
  "community_events",
  {
    id: int("id").autoincrement().primaryKey(),
    guildId: varchar("guildId", { length: 32 }).notNull(),
    channelId: varchar("channelId", { length: 32 }).notNull(),
    messageId: varchar("messageId", { length: 32 }),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description").notNull(),
    startsAt: timestamp("startsAt").notNull(),
    reminderMinutes: int("reminderMinutes").default(30).notNull(),
    status: mysqlEnum("status", ["scheduled", "completed", "cancelled"]).default("scheduled").notNull(),
    createdById: varchar("createdById", { length: 32 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("event_guild_status_start_idx").on(table.guildId, table.status, table.startsAt)],
);

export const eventRsvps = mysqlTable(
  "event_rsvps",
  {
    id: int("id").autoincrement().primaryKey(),
    eventId: int("eventId").notNull(),
    memberId: varchar("memberId", { length: 32 }).notNull(),
    state: mysqlEnum("state", ["going", "maybe", "declined"]).default("going").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("event_rsvp_member_idx").on(table.eventId, table.memberId)],
);

export const suggestions = mysqlTable(
  "suggestions",
  {
    id: int("id").autoincrement().primaryKey(),
    guildId: varchar("guildId", { length: 32 }).notNull(),
    channelId: varchar("channelId", { length: 32 }).notNull(),
    messageId: varchar("messageId", { length: 32 }),
    authorId: varchar("authorId", { length: 32 }).notNull(),
    content: text("content").notNull(),
    anonymous: boolean("anonymous").default(false).notNull(),
    status: mysqlEnum("status", ["open", "accepted", "declined", "implemented"]).default("open").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("suggestion_guild_status_idx").on(table.guildId, table.status)],
);

export const polls = mysqlTable(
  "polls",
  {
    id: int("id").autoincrement().primaryKey(),
    guildId: varchar("guildId", { length: 32 }).notNull(),
    channelId: varchar("channelId", { length: 32 }).notNull(),
    messageId: varchar("messageId", { length: 32 }),
    question: varchar("question", { length: 256 }).notNull(),
    anonymous: boolean("anonymous").default(false).notNull(),
    endsAt: timestamp("endsAt"),
    status: mysqlEnum("status", ["active", "closed"]).default("active").notNull(),
    createdById: varchar("createdById", { length: 32 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("poll_guild_status_idx").on(table.guildId, table.status)],
);

export const pollOptions = mysqlTable(
  "poll_options",
  {
    id: int("id").autoincrement().primaryKey(),
    pollId: int("pollId").notNull(),
    label: varchar("label", { length: 128 }).notNull(),
    position: int("position").notNull(),
  },
  table => [index("poll_option_poll_idx").on(table.pollId, table.position)],
);

export const pollVotes = mysqlTable(
  "poll_votes",
  {
    id: int("id").autoincrement().primaryKey(),
    pollId: int("pollId").notNull(),
    optionId: int("optionId").notNull(),
    memberId: varchar("memberId", { length: 32 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("poll_vote_member_idx").on(table.pollId, table.memberId)],
);

export const economyProfiles = mysqlTable(
  "economy_profiles",
  {
    id: int("id").autoincrement().primaryKey(),
    guildId: varchar("guildId", { length: 32 }).notNull(),
    memberId: varchar("memberId", { length: 32 }).notNull(),
    balance: int("balance").default(0).notNull(),
    reputation: int("reputation").default(0).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("economy_guild_member_idx").on(table.guildId, table.memberId)],
);

export const economyTransactions = mysqlTable(
  "economy_transactions",
  {
    id: int("id").autoincrement().primaryKey(),
    guildId: varchar("guildId", { length: 32 }).notNull(),
    memberId: varchar("memberId", { length: 32 }).notNull(),
    counterpartyId: varchar("counterpartyId", { length: 32 }),
    amount: int("amount").notNull(),
    kind: mysqlEnum("kind", ["admin", "transfer", "reward", "shop", "game"]).notNull(),
    reason: varchar("reason", { length: 256 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("economy_tx_guild_member_idx").on(table.guildId, table.memberId, table.createdAt)],
);

export const roleShopItems = mysqlTable(
  "role_shop_items",
  {
    id: int("id").autoincrement().primaryKey(),
    guildId: varchar("guildId", { length: 32 }).notNull(),
    roleId: varchar("roleId", { length: 32 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    cost: int("cost").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("shop_guild_enabled_idx").on(table.guildId, table.enabled)],
);

export const streamAnnouncements = mysqlTable(
  "stream_announcements",
  {
    id: int("id").autoincrement().primaryKey(),
    guildId: varchar("guildId", { length: 32 }).notNull(),
    name: varchar("name", { length: 96 }).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    destinationChannelId: varchar("destinationChannelId", { length: 32 }).notNull(),
    mentionRoleId: varchar("mentionRoleId", { length: 32 }),
    sourceLabel: varchar("sourceLabel", { length: 80 }).notNull(),
    sourceUrl: varchar("sourceUrl", { length: 1024 }),
    messageTemplate: text("messageTemplate"),
    secretHash: varchar("secretHash", { length: 64 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("stream_announcement_guild_idx").on(table.guildId, table.enabled)],
);

export const streamAnnouncementDeliveries = mysqlTable(
  "stream_announcement_deliveries",
  {
    id: int("id").autoincrement().primaryKey(),
    announcementId: int("announcementId").notNull(),
    eventKeyHash: varchar("eventKeyHash", { length: 64 }).notNull().unique(),
    deliveredAt: timestamp("deliveredAt").defaultNow().notNull(),
  },
  table => [index("stream_delivery_announcement_idx").on(table.announcementId, table.deliveredAt)],
);

export type GuildSettings = typeof guildSettings.$inferSelect;
export type LogChannelRoute = typeof logChannelRoutes.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type ModerationCase = typeof moderationCases.$inferSelect;
export type XpProfile = typeof xpProfiles.$inferSelect;
export type CommandRolePermission = typeof commandRolePermissions.$inferSelect;
export type BotBlacklist = typeof botBlacklists.$inferSelect;
export type JailRecord = typeof jailRecords.$inferSelect;
