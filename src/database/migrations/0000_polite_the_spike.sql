CREATE TABLE `activity_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`message` text NOT NULL,
	`meta` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text NOT NULL,
	`schedule_at` integer,
	`published_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `contents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text,
	`body` text NOT NULL,
	`status` text NOT NULL,
	`rejection_reason` text,
	`ai_generated` integer DEFAULT false NOT NULL,
	`campaign_id` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content_id` integer NOT NULL,
	`threads_account_id` integer,
	`thread_id` text,
	`status` text NOT NULL,
	`error_message` text,
	`published_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `threads_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`threads_user_id` text NOT NULL,
	`access_token` text NOT NULL,
	`token_expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `threads_accounts_threads_user_id_unique` ON `threads_accounts` (`threads_user_id`);