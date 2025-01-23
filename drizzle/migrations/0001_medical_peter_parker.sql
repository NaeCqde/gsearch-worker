PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_cookies` (
	`aec` text NOT NULL,
	`nid` text,
	`secureEnid` text
);
--> statement-breakpoint
INSERT INTO `__new_cookies`("aec", "nid", "secureEnid") SELECT "aec", "nid", "secureEnid" FROM `cookies`;--> statement-breakpoint
DROP TABLE `cookies`;--> statement-breakpoint
ALTER TABLE `__new_cookies` RENAME TO `cookies`;--> statement-breakpoint
PRAGMA foreign_keys=ON;