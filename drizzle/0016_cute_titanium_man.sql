ALTER TABLE `warning_records` ADD COLUMN IF NOT EXISTS `appealNote` varchar(600);--> statement-breakpoint
ALTER TABLE `warning_records` ADD COLUMN IF NOT EXISTS `appealSubmittedAt` timestamp;
