CREATE TABLE `account_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`token_hash` text NOT NULL,
	`role` text,
	`note` text,
	`target_user_id` integer,
	`used_by_user_id` integer,
	`created_by` integer,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`revoked_at` integer,
	FOREIGN KEY (`target_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`used_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_links_token_hash_unique` ON `account_links` (`token_hash`);--> statement-breakpoint
CREATE INDEX `account_links_target_idx` ON `account_links` (`target_user_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `disabled_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `sessions_valid_after` integer;