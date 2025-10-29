import { tool } from 'ai';
import { z } from 'zod';
import Exa from 'exa-js';

import 'dotenv/config'

const exa = new Exa(process.env.EXA_SEARCH_API_KEY);

const searchTool = tool({
    description: 'Search the web for information',
    inputSchema: z.object({
        query: z.string().describe('The query to search for'),
    }),
    execute: async ({ query }: { query: string }) => {
            const searchResult = await exa.getContents(
                [query], {
                    apiKey: process.env.EXASEARCH_API_KEY || import.meta.env.EXA_SEARCH_API_KEY || '',
                    text: true
                }
              );
              
            const result = {
                searchResult,
            }
    
            return { message: 'Search completed', result };
        },
});

export default searchTool;
