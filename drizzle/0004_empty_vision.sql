CREATE TABLE `structured_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`disease_category` text NOT NULL,
	`modality` text NOT NULL,
	`lang` text NOT NULL,
	`findings` text NOT NULL,
	`form_state` text,
	`report` text NOT NULL,
	`prompt_hash` text NOT NULL,
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
CREATE INDEX `structured_reports_created_at_idx` ON `structured_reports` (`created_at`);--> statement-breakpoint
CREATE INDEX `structured_reports_disease_idx` ON `structured_reports` (`disease_category`);