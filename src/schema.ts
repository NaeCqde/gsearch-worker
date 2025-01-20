import type { InferSelectModel } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const cookies = sqliteTable('cookies', {
    aec: text().notNull(),
    nid: text().notNull(),
});

export type Cookie = InferSelectModel<typeof cookies>;
