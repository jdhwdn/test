CREATE TABLE `automod_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guildId` varchar(32) NOT NULL,
	`name` varchar(96) NOT NULL,
	`type` enum('keyword','invite','caps','flood') NOT NULL,
	`pattern` text,
	`action` enum('delete','warn','mute','kick') NOT NULL DEFAULT 'delete',
	`exemptRoleId` varchar(32),
	`enabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `automod_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `community_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guildId` varchar(32) NOT NULL,
	`channelId` varchar(32) NOT NULL,
	`messageId` varchar(32),
	`title` varchar(160) NOT NULL,
	`description` text NOT NULL,
	`startsAt` timestamp NOT NULL,
	`reminderMinutes` int NOT NULL DEFAULT 30,
	`status` enum('scheduled','completed','cancelled') NOT NULL DEFAULT 'scheduled',
	`createdById` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `community_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `economy_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guildId` varchar(32) NOT NULL,
	`memberId` varchar(32) NOT NULL,
	`balance` int NOT NULL DEFAULT 0,
	`reputation` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `economy_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `economy_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guildId` varchar(32) NOT NULL,
	`memberId` varchar(32) NOT NULL,
	`counterpartyId` varchar(32),
	`amount` int NOT NULL,
	`kind` enum('admin','transfer','reward','shop','game') NOT NULL,
	`reason` varchar(256) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `economy_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event_rsvps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` int NOT NULL,
	`memberId` varchar(32) NOT NULL,
	`state` enum('going','maybe','declined') NOT NULL DEFAULT 'going',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `event_rsvps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `giveaway_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`giveawayId` int NOT NULL,
	`memberId` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `giveaway_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `giveaways` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guildId` varchar(32) NOT NULL,
	`channelId` varchar(32) NOT NULL,
	`messageId` varchar(32),
	`prize` varchar(256) NOT NULL,
	`winnerCount` int NOT NULL DEFAULT 1,
	`requiredRoleId` varchar(32),
	`minimumLevel` int NOT NULL DEFAULT 0,
	`endsAt` timestamp NOT NULL,
	`status` enum('active','ended','cancelled') NOT NULL DEFAULT 'active',
	`createdById` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `giveaways_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `level_role_rewards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guildId` varchar(32) NOT NULL,
	`level` int NOT NULL,
	`roleId` varchar(32) NOT NULL,
	`announce` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `level_role_rewards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `poll_options` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pollId` int NOT NULL,
	`label` varchar(128) NOT NULL,
	`position` int NOT NULL,
	CONSTRAINT `poll_options_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `poll_votes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pollId` int NOT NULL,
	`optionId` int NOT NULL,
	`memberId` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `poll_votes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `polls` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guildId` varchar(32) NOT NULL,
	`channelId` varchar(32) NOT NULL,
	`messageId` varchar(32),
	`question` varchar(256) NOT NULL,
	`anonymous` boolean NOT NULL DEFAULT false,
	`endsAt` timestamp,
	`status` enum('active','closed') NOT NULL DEFAULT 'active',
	`createdById` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `polls_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `role_shop_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guildId` varchar(32) NOT NULL,
	`roleId` varchar(32) NOT NULL,
	`name` varchar(128) NOT NULL,
	`cost` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `role_shop_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suggestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guildId` varchar(32) NOT NULL,
	`channelId` varchar(32) NOT NULL,
	`messageId` varchar(32),
	`authorId` varchar(32) NOT NULL,
	`content` text NOT NULL,
	`anonymous` boolean NOT NULL DEFAULT false,
	`status` enum('open','accepted','declined','implemented') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `suggestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guildId` varchar(32) NOT NULL,
	`panelId` int NOT NULL,
	`channelId` varchar(32) NOT NULL,
	`openerId` varchar(32) NOT NULL,
	`openerLabel` varchar(128) NOT NULL,
	`status` enum('open','claimed','closed') NOT NULL DEFAULT 'open',
	`claimedById` varchar(32),
	`closedById` varchar(32),
	`closedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `support_tickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ticket_panels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guildId` varchar(32) NOT NULL,
	`channelId` varchar(32) NOT NULL,
	`messageId` varchar(32),
	`categoryId` varchar(32),
	`staffRoleId` varchar(32) NOT NULL,
	`title` varchar(128) NOT NULL,
	`description` text NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ticket_panels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `warning_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guildId` varchar(32) NOT NULL,
	`memberId` varchar(32) NOT NULL,
	`memberLabel` varchar(128) NOT NULL,
	`moderatorId` varchar(32) NOT NULL,
	`moderatorLabel` varchar(128) NOT NULL,
	`reason` text NOT NULL,
	`expiresAt` timestamp,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `warning_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `activity_logs` MODIFY COLUMN `category` enum('moderation','voice','members','roles','channels','messages','xp','welcome','interactions','system','community','tickets','economy','ai') NOT NULL;--> statement-breakpoint
ALTER TABLE `log_channel_routes` MODIFY COLUMN `category` enum('moderation','voice','members','roles','channels','messages','xp','welcome','interactions','system','community','tickets','economy','ai') NOT NULL;--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `xpEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `xpPerMessage` int DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `xpCooldownSeconds` int DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `xpAnnouncementChannelId` varchar(32);--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `xpLevelUpMessage` text;--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `antiSpamEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `antiSpamMaxMessages` int DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `antiSpamWindowSeconds` int DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `antiLinkEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `antiBotEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `antiRaidEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `antiRaidJoinLimit` int DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `antiRaidWindowSeconds` int DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `autoMuteMinutes` int DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `autoKickEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `autoCleanEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `autoCleanMinutes` int DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `moderatorReportChannelId` varchar(32);--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `aiEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `aiRulesText` text;--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `aiTranslationEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `aiTicketSummariesEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `automod_guild_enabled_idx` ON `automod_rules` (`guildId`,`enabled`);--> statement-breakpoint
CREATE INDEX `event_guild_status_start_idx` ON `community_events` (`guildId`,`status`,`startsAt`);--> statement-breakpoint
CREATE INDEX `economy_guild_member_idx` ON `economy_profiles` (`guildId`,`memberId`);--> statement-breakpoint
CREATE INDEX `economy_tx_guild_member_idx` ON `economy_transactions` (`guildId`,`memberId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `event_rsvp_member_idx` ON `event_rsvps` (`eventId`,`memberId`);--> statement-breakpoint
CREATE INDEX `giveaway_entry_member_idx` ON `giveaway_entries` (`giveawayId`,`memberId`);--> statement-breakpoint
CREATE INDEX `giveaway_guild_status_ends_idx` ON `giveaways` (`guildId`,`status`,`endsAt`);--> statement-breakpoint
CREATE INDEX `level_reward_guild_level_idx` ON `level_role_rewards` (`guildId`,`level`);--> statement-breakpoint
CREATE INDEX `poll_option_poll_idx` ON `poll_options` (`pollId`,`position`);--> statement-breakpoint
CREATE INDEX `poll_vote_member_idx` ON `poll_votes` (`pollId`,`memberId`);--> statement-breakpoint
CREATE INDEX `poll_guild_status_idx` ON `polls` (`guildId`,`status`);--> statement-breakpoint
CREATE INDEX `shop_guild_enabled_idx` ON `role_shop_items` (`guildId`,`enabled`);--> statement-breakpoint
CREATE INDEX `suggestion_guild_status_idx` ON `suggestions` (`guildId`,`status`);--> statement-breakpoint
CREATE INDEX `ticket_guild_status_idx` ON `support_tickets` (`guildId`,`status`);--> statement-breakpoint
CREATE INDEX `ticket_panel_guild_idx` ON `ticket_panels` (`guildId`);--> statement-breakpoint
CREATE INDEX `warning_guild_member_idx` ON `warning_records` (`guildId`,`memberId`,`createdAt`);