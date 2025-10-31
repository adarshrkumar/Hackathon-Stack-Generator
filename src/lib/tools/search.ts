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
            if (!import.meta.env?.EXASEARCH_API_KEY) {
                const msg = 'Error API KEY EXASEARCH_API_KEY not found in ENV'
                console.error(msg)
                return { status: 'error', message: msg}
            }

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
