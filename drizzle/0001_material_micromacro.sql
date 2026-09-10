CREATE TABLE `anonymous_chat_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chatId` int NOT NULL,
	`telegramUserId` varchar(64) NOT NULL,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`leftAt` timestamp,
	CONSTRAINT `anonymous_chat_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `chat_members_chat_user_unique` UNIQUE(`chatId`,`telegramUserId`)
);
--> statement-breakpoint
CREATE TABLE `anonymous_chat_names` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chatId` int NOT NULL,
	`telegramUserId` varchar(64) NOT NULL,
	`name` varchar(80) NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `anonymous_chat_names_id` PRIMARY KEY(`id`),
	CONSTRAINT `chat_names_chat_user_unique` UNIQUE(`chatId`,`telegramUserId`)
);
--> statement-breakpoint
CREATE TABLE `anonymous_chats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`status` enum('waiting','active','closed') NOT NULL DEFAULT 'waiting',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `anonymous_chats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `anonymous_contact_reveals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chatId` int NOT NULL,
	`fromTelegramUserId` varchar(64) NOT NULL,
	`toTelegramUserId` varchar(64) NOT NULL,
	`revealedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `anonymous_contact_reveals_id` PRIMARY KEY(`id`),
	CONSTRAINT `contact_reveals_chat_from_to_unique` UNIQUE(`chatId`,`fromTelegramUserId`,`toTelegramUserId`)
);
--> statement-breakpoint
CREATE TABLE `anonymous_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chatId` int NOT NULL,
	`senderTelegramUserId` varchar(64) NOT NULL,
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `anonymous_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `telegram_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`telegramUserId` varchar(64) NOT NULL,
	`username` varchar(255),
	`firstName` varchar(255),
	`flowState` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `telegram_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegram_users_telegramUserId_unique` UNIQUE(`telegramUserId`)
);
--> statement-breakpoint
CREATE INDEX `chat_members_user_idx` ON `anonymous_chat_members` (`telegramUserId`);--> statement-breakpoint
CREATE INDEX `anonymous_chats_status_idx` ON `anonymous_chats` (`status`);--> statement-breakpoint
CREATE INDEX `messages_chat_created_idx` ON `anonymous_messages` (`chatId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `telegram_users_last_seen_idx` ON `telegram_users` (`lastSeenAt`);