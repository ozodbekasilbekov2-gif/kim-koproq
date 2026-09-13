CREATE TABLE `telegram_chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`telegramChatId` varchar(64) NOT NULL,
	`telegramMessageId` int NOT NULL,
	`direction` enum('incoming','outgoing') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `telegram_chat_messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegram_chat_message_unique` UNIQUE(`telegramChatId`,`telegramMessageId`)
);
