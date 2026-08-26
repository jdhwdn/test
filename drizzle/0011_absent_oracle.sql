CREATE TABLE `stream_announcement_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`announcementId` int NOT NULL,
	`eventKeyHash` varchar(64) NOT NULL,
	`deliveredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stream_announcement_deliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `stream_announcement_deliveries_eventKeyHash_unique` UNIQUE(`eventKeyHash`)
);
--> statement-breakpoint
CREATE TABLE `stream_announcements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guildId` varchar(32) NOT NULL,
	`name` varchar(96) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`destinationChannelId` varchar(32) NOT NULL,
	`mentionRoleId` varchar(32),
	`sourceLabel` varchar(80) NOT NULL,
	`sourceUrl` varchar(1024),
	`messageTemplate` text,
	`secretHash` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stream_announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `stream_delivery_announcement_idx` ON `stream_announcement_deliveries` (`announcementId`,`deliveredAt`);--> statement-breakpoint
CREATE INDEX `stream_announcement_guild_idx` ON `stream_announcements` (`guildId`,`enabled`);