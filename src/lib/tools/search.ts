import { tool } from 'ai';
import { z } from 'zod';
import Exa from 'exa-js';

const exa = new Exa(process.env.EXA_SEARCH_API_KEY);

const searchTool = tool({
    description: 'Search the web for information',
    parameters: z.object({
        query: z.string().describe('The query to search for'),
    }),
    execute: async ({ query }) => {
            const searchResult = await exa.getContents(
                [query],
                { text: true }
              );
              
            const result = {
                searchResult,
            }
    
            return { message: 'Search completed', result };
        },
});

export default searchTool;
