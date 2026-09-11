CREATE TABLE `telegram_user_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`telegramUserId` varchar(64) NOT NULL,
	`fontScale` varchar(20) NOT NULL DEFAULT 'medium',
	`chatBackground` varchar(20) NOT NULL DEFAULT 'paper',
	`messageColor` varchar(20) NOT NULL DEFAULT '#172033',
	`theme` enum('light','dark') NOT NULL DEFAULT 'light',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegram_user_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegram_user_settings_telegramUserId_unique` UNIQUE(`telegramUserId`)
);
--> statement-breakpoint
CREATE TABLE `telegram_user_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`telegramUserId` varchar(64) NOT NULL,
	`label` varchar(48) NOT NULL,
	`normalizedLabel` varchar(48) NOT NULL,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegram_user_tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_tags_user_label_unique` UNIQUE(`telegramUserId`,`normalizedLabel`)
);
--> statement-breakpoint
ALTER TABLE `anonymous_chat_names` ADD `iconKey` varchar(40) DEFAULT 'message-circle' NOT NULL;--> statement-breakpoint
ALTER TABLE `anonymous_chat_names` ADD `color` varchar(20) DEFAULT '#6d5dfc' NOT NULL;--> statement-breakpoint
ALTER TABLE `anonymous_chat_names` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `anonymous_messages` ADD `editedAt` timestamp;--> statement-breakpoint
ALTER TABLE `anonymous_messages` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `telegram_users` ADD `displayName` varchar(120);--> statement-breakpoint
ALTER TABLE `telegram_users` ADD `iconKey` varchar(40) DEFAULT 'message-circle' NOT NULL;--> statement-breakpoint
ALTER TABLE `telegram_users` ADD `accentColor` varchar(20) DEFAULT '#6d5dfc' NOT NULL;--> statement-breakpoint
CREATE INDEX `user_tags_normalized_idx` ON `telegram_user_tags` (`normalizedLabel`);