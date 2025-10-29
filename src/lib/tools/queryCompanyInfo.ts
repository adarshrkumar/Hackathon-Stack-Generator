import { tool } from 'ai';
import { z } from 'zod';
import { db } from '../../db/initialize';
import { companyInfoTable } from '../../db/schema';
import { like, or, eq } from 'drizzle-orm';

/**
 * Query Company Info Tool
 *
 * Searches the company_info database table for products/services.
 * Returns product details including name, provider, description, key features, and documentation URLs.
 */
const queryCompanyInfoTool = tool({
    description: 'Query the company_info database to find products and services. Use this to search for specific technologies, cloud services, databases, frameworks, or any other products. Returns product name, provider, subcategory, description, key features, and documentation URLs.',
    inputSchema: z.object({
        searchTerm: z.string().optional().describe('Search term to find products (searches in name, provider, subcategory, description, and key features). Leave empty to get all products.'),
        provider: z.string().optional().describe('Filter by specific provider/company name (e.g., "AWS", "Google", "Microsoft")'),
        subcategory: z.string().optional().describe('Filter by subcategory (e.g., "Database", "Storage", "Compute")'),
        limit: z.number().optional().default(20).describe('Maximum number of results to return (default: 20, max: 100)')
    }),
    execute: async ({ searchTerm, provider, subcategory, limit = 20 }: { searchTerm?: string; provider?: string; subcategory?: string; limit?: number }) => {
        try {
            // Limit max results to 100
            const maxResults = Math.min(limit, 100);

            let query = db.select().from(companyInfoTable);

            // Build where conditions
            const conditions = [];

            if (searchTerm) {
                conditions.push(
                    or(
                        like(companyInfoTable.name, `%${searchTerm}%`),
                        like(companyInfoTable.provider, `%${searchTerm}%`),
                        like(companyInfoTable.subcategory, `%${searchTerm}%`),
                        like(companyInfoTable.description, `%${searchTerm}%`),
                        like(companyInfoTable.keyfeature, `%${searchTerm}%`)
                    )
                );
            }

            if (provider) {
                conditions.push(like(companyInfoTable.provider, `%${provider}%`));
            }

            if (subcategory) {
                conditions.push(like(companyInfoTable.subcategory, `%${subcategory}%`));
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
                message: `Found ${results.length} product(s)`,
                result: {
                    success: true,
                    count: results.length,
                    products: results.map(product => ({
                        name: product.name,
                        provider: product.provider,
                        subcategory: product.subcategory,
                        description: product.description,
                        keyFeature: product.keyfeature,
                        documentationUrl: product.documentation,
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

export default queryCompanyInfoTool;
