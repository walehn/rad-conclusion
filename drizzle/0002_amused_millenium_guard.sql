CREATE TABLE `generations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batch_id` text NOT NULL,
	`user_id` integer,
	`findings` text NOT NULL,
	`conclusion` text NOT NULL,
	`prompt_version` text NOT NULL,
	`style` text NOT NULL,
	`lang` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`finish_reason` text,
	`prompt_tokens` integer,
	`completion_tokens` integer,
	`ttft_ms` integer,
	`total_ms` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `generations_created_at_idx` ON `generations` (`created_at`);--> statement-breakpoint
CREATE INDEX `generations_batch_id_idx` ON `generations` (`batch_id`);