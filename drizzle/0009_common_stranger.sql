CREATE TABLE `community_knowledge_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guildId` varchar(32) NOT NULL,
	`kind` enum('rule','faq') NOT NULL,
	`title` varchar(160) NOT NULL,
	`content` text NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `community_knowledge_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `knowledge_guild_kind_enabled_idx` ON `community_knowledge_items` (`guildId`,`kind`,`enabled`);