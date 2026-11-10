ALTER TABLE `users` ADD `role` text DEFAULT 'restricted' NOT NULL;--> statement-breakpoint
-- Every account that exists when roles are introduced was provisioned as an
-- admin by scripts/seed-user.ts, so it keeps full access. Accounts created
-- afterwards get the column default ('restricted') unless seeded otherwise.
UPDATE `users` SET `role` = 'admin';
