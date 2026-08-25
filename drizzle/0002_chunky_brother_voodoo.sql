CREATE TABLE `command_role_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guildId` varchar(32) NOT NULL,
	`commandKey` varchar(48) NOT NULL,
	`roleId` varchar(32) NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `command_role_permissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jail_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guildId` varchar(32) NOT NULL,
	`memberId` varchar(32) NOT NULL,
	`memberLabel` varchar(128) NOT NULL,
	`jailedById` varchar(32) NOT NULL,
	`jailedByLabel` varchar(128) NOT NULL,
	`jailRoleId` varchar(32) NOT NULL,
	`jailChannelId` varchar(32) NOT NULL,
	`messageId` varchar(32),
	`reason` text NOT NULL,
	`rolesJson` text NOT NULL,
	`releasedAt` timestamp,
	`releasedById` varchar(32),
	`releasedByLabel` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jail_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `jailChannelId` varchar(32);--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `guardEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `guardWindowSeconds` int DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `guardMaxRoleChanges` int DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `guardMaxChannelChanges` int DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `guardMaxBans` int DEFAULT 3 NOT NULL;--> statement-breakpoint
CREATE INDEX `command_permission_guild_command_idx` ON `command_role_permissions` (`guildId`,`commandKey`);--> statement-breakpoint
CREATE INDEX `jail_guild_member_active_idx` ON `jail_records` (`guildId`,`memberId`,`releasedAt`);