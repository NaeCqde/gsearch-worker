import type { InferSelectModel } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const cookies = sqliteTable('cookies', {
    aec: text().notNull(),
    nid: text(),
    secureEnid: text(),
});

export type Cookie = InferSelectModel<typeof cookies>;
