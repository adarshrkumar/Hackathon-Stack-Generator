import { tool } from 'ai';
import { z } from 'zod';

// execute imports
import { db } from '../../db/initialize';
import { threadsTable } from '../../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Update Thread Cost Tool
 *
 * Updates the total cost for a conversation thread in the database
 * by adding the provided cost increment to the current cost value.
 */
const updateThreadCostTool = tool({
    description: 'Updates the total cost for a conversation thread in the database by adding the provided cost increment to the current cost value. Use this tool to track API usage costs.',
    inputSchema: z.object({
        threadId: z.string().describe('The unique identifier of the thread to update'),
        costIncrement: z.number().describe('The cost amount to add to the current thread cost (in dollars). This will be added to any existing cost value.')
    }),
    execute: async ({ threadId, costIncrement }: { threadId: string; costIncrement: number }) => {
            try {

                // Fetch current thread
                const threads = await db
                    .select()
                    .from(threadsTable)
                    .where(eq(threadsTable.id, threadId))
                    .limit(1);

                if (threads.length === 0) {
                    throw new Error(`Thread ${threadId} not found`);
                }

                const currentCost = threads[0].cost || 0;
                const newCost = currentCost + costIncrement;

                // Update the cost
                await db
                    .update(threadsTable)
                    .set({
                        cost: newCost,
                        updatedAt: new Date()
                    })
                    .where(eq(threadsTable.id, threadId));

                return {
                    message: 'Thread cost updated successfully',
                    result: {
                        success: true,
                        threadId: threadId,
                        costIncrement: costIncrement,
                        totalCost: newCost
                    }
                };
            } catch (error) {
                return {
                    message: 'Failed to update thread cost',
                    result: {
                        success: false,
                        error: error instanceof Error ? error.message : String(error)
                    }
                };
            }
        },
});

export default updateThreadCostTool;
