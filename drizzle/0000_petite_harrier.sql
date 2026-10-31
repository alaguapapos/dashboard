CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`cents` integer NOT NULL,
	`method` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
