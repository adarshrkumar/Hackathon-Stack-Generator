import { pgTable, text, timestamp, jsonb, boolean, integer } from 'drizzle-orm/pg-core';

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
    cost: integer('cost_dollars').notNull().default(0),

    // Whether the thread is publicly accessible
    isPublic: boolean('is_public').notNull().default(false),

    // Whether this is a development/test thread
    isDev: boolean('is_dev').notNull().default(false),

    // Creation timestamp
    createdAt: timestamp('created_at').notNull().defaultNow(),

    // Last update timestamp
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

const megaListTable = pgTable('mega_list', {
    name: text('name').primaryKey(),
    type: text('type').notNull().default(''),
    subtype: text('subtype'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

const companyInfoTable = pgTable('company_info', {
    name: text('product_name').primaryKey(),
    provider: text('provider').notNull().default(''),
    subcategory: text('sub_category').notNull().default(''),
    description: text('description').notNull().default(''),
    keyfeature: text('key_feature').notNull().default(''),
    documentation: text('documentation').notNull().default(''),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export { threadsTable };