CREATE TABLE `bot_blacklists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guildId` varchar(32) NOT NULL,
	`memberId` varchar(32) NOT NULL,
	`addedById` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bot_blacklists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `blacklist_guild_member_idx` ON `bot_blacklists` (`guildId`,`memberId`);