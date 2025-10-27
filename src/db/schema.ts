import { pgTable, text, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';

/**
 * Threads Table Schema
 *
 * Stores conversation threads with message history.
 * Migrated from DynamoDB to PostgreSQL with Drizzle ORM.
 */
const threadsTable = pgTable('threads', {
    // Unique thread identifier (primary key)
    id: text('id').primaryKey(),

    // Thread title (generated from conversation)
    title: text('title').notNull().default(''),

    // Thread data containing messages and metadata
    // Structure: { messages: [{ role: 'system' | 'user' | 'assistant', content: string }] }
    thread: jsonb('thread').notNull().$type<{ messages: Array<{ role: string; content: string }> }>(),

    // User email for ownership tracking
    email: text('email'),

    // Whether the thread is publicly accessible
    isPublic: boolean('is_public').notNull().default(false),

    // Whether this is a development/test thread
    isDev: boolean('is_dev').notNull().default(false),

    // Creation timestamp
    createdAt: timestamp('created_at').notNull().defaultNow(),

    // Last update timestamp
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export { threadsTable };