ALTER TABLE `expenses` ADD `cash_source` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `spent_by` text;--> statement-breakpoint
ALTER TABLE `expenses` ADD `receipt_key` text;--> statement-breakpoint
ALTER TABLE `expenses` ADD `receipt_name` text;--> statement-breakpoint
ALTER TABLE `expenses` ADD `receipt_type` text;