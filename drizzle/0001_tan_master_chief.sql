CREATE TABLE `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guildId` varchar(32) NOT NULL,
	`category` enum('moderation','voice','members','roles','channels','messages','xp','welcome','system') NOT NULL,
	`eventKey` varchar(96) NOT NULL,
	`title` varchar(160) NOT NULL,
	`accentColor` varchar(12) NOT NULL,
	`icon` varchar(32) NOT NULL,
	`actorId` varchar(32),
	`actorLabel` varchar(128),
	`targetId` varchar(32),
	`targetLabel` varchar(128),
	`reason` text,
	`detailsJson` text NOT NULL,
	`destinationChannelId` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `guild_settings` (
	`guildId` varchar(32) NOT NULL,
	`guildName` varchar(128) NOT NULL,
	`botEnabled` boolean NOT NULL DEFAULT true,
	`welcomeEnabled` boolean NOT NULL DEFAULT false,
	`welcomeChannelId` varchar(32),
	`welcomeMessage` text,
	`mutedRoleId` varchar(32),
	`jailRoleId` varchar(32),
	`warningLimit` int NOT NULL DEFAULT 3,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `guild_settings_guildId` PRIMARY KEY(`guildId`)
);
--> statement-breakpoint
CREATE TABLE `log_channel_routes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guildId` varchar(32) NOT NULL,
	`category` enum('moderation','voice','members','roles','channels','messages','xp','welcome','system') NOT NULL,
	`channelId` varchar(32) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `log_channel_routes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `moderation_cases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guildId` varchar(32) NOT NULL,
	`action` enum('ban','kick','mute','unmute','deafen','undeafen','warn','jail','unjail') NOT NULL,
	`executorId` varchar(32) NOT NULL,
	`executorLabel` varchar(128) NOT NULL,
	`memberId` varchar(32) NOT NULL,
	`memberLabel` varchar(128) NOT NULL,
	`reason` text NOT NULL,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `moderation_cases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `xp_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guildId` varchar(32) NOT NULL,
	`memberId` varchar(32) NOT NULL,
	`memberLabel` varchar(128) NOT NULL,
	`xp` int NOT NULL DEFAULT 0,
	`level` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `xp_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `activity_guild_created_idx` ON `activity_logs` (`guildId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `activity_guild_category_idx` ON `activity_logs` (`guildId`,`category`);--> statement-breakpoint
CREATE INDEX `log_route_guild_category_idx` ON `log_channel_routes` (`guildId`,`category`);--> statement-breakpoint
CREATE INDEX `moderation_guild_member_idx` ON `moderation_cases` (`guildId`,`memberId`);--> statement-breakpoint
CREATE INDEX `xp_guild_member_idx` ON `xp_profiles` (`guildId`,`memberId`);--> statement-breakpoint
CREATE INDEX `xp_guild_rank_idx` ON `xp_profiles` (`guildId`,`xp`);