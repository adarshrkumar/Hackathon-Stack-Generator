import { tool } from 'ai';
import { z } from 'zod';
import { db } from '../../db/initialize';
import { megaListTable } from '../../db/schema';
import { like, or, eq } from 'drizzle-orm';

/**
 * Query Mega List Tool
 *
 * Searches the mega_list database table for technology categories and types.
 * Returns high-level categories of technologies available.
 */
const queryMegaListTool = tool({
    description: 'Query the mega_list database to browse technology categories and types. Use this to explore what types of technologies are available (e.g., databases, cloud providers, frameworks). Returns name, type, and subtype information.',
    inputSchema: z.object({
        searchTerm: z.string().optional().describe('Search term to find technology categories (searches in name, type, and subtype). Leave empty to get all categories.'),
        type: z.string().optional().describe('Filter by specific type (e.g., "database", "cloud", "framework")'),
        limit: z.number().optional().default(50).describe('Maximum number of results to return (default: 50, max: 200)')
    }),
    execute: async ({ searchTerm, type, limit = 50 }: { searchTerm?: string; type?: string; limit?: number }) => {
        try {
            // Limit max results to 200
            const maxResults = Math.min(limit, 200);

            let query = db.select().from(megaListTable);

            // Build where conditions
            const conditions = [];

            if (searchTerm) {
                conditions.push(
                    or(
                        like(megaListTable.name, `%${searchTerm}%`),
                        like(megaListTable.type, `%${searchTerm}%`),
                        like(megaListTable.subtype, `%${searchTerm}%`)
                    )
                );
            }

            if (type) {
                conditions.push(like(megaListTable.type, `%${type}%`));
            }

            // Apply conditions if any
            if (conditions.length > 0) {
                query = query.where(
                    conditions.length === 1
                        ? conditions[0]
                        : or(...conditions)
                ) as any;
            }

            // Execute query with limit
            const results = await query.limit(maxResults);

            return {
                message: `Found ${results.length} technology category/categories`,
                result: {
                    success: true,
                    count: results.length,
                    categories: results.map(item => ({
                        name: item.name,
                        type: item.type,
                        subtype: item.subtype,
                    }))
                }
            };
        } catch (error) {
            return {
                message: 'Query failed',
                result: {
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                }
            };
        }
    },
});

export default queryMegaListTool;
