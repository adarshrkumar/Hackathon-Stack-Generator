import { tool } from 'ai';
import { z } from 'zod';
import Exa from 'exa-js';

const exa = new Exa(process.env.EXA_SEARCH_API_KEY);

/**
 * Get Page Content Tool
 *
 * Fetches the content of one or more URLs using Exa's getContents API.
 * Useful for retrieving documentation pages from URLs in the database.
 */
const getPageContentTool = tool({
    description: 'Fetch the text content of web pages from URLs. Use this to retrieve documentation, articles, or any web page content. Supports fetching multiple URLs at once.',
    inputSchema: z.object({
        urls: z.array(z.string().url()).describe('Array of URLs to fetch content from. Must be valid URLs starting with http:// or https://'),
        includeText: z.boolean().optional().default(true).describe('Whether to include full text content (default: true)'),
    }),
    execute: async ({ urls, includeText = true }: { urls: string[]; includeText?: boolean }) => {
        try {
            if (urls.length === 0) {
                return {
                    message: 'No URLs provided',
                    result: {
                        success: false,
                        error: 'URLs array is empty'
                    }
                };
            }

            if (urls.length > 10) {
                return {
                    message: 'Too many URLs',
                    result: {
                        success: false,
                        error: 'Maximum 10 URLs allowed per request'
                    }
                };
            }

            const searchResult = await exa.getContents(urls, {
                text: includeText ? true : undefined,
            });

            const results = searchResult.results.map((result: any) => ({
                url: result.url,
                title: result.title,
                text: result.text,
                author: result.author,
                publishedDate: result.publishedDate,
            }));

            return {
                message: `Successfully fetched content from ${results.length} URL(s)`,
                result: {
                    success: true,
                    count: results.length,
                    pages: results,
                }
            };
        } catch (error) {
            return {
                message: 'Failed to fetch page content',
                result: {
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                }
            };
        }
    },
});

export default getPageContentTool;
