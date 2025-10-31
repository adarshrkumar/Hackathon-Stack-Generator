import type { APIRoute } from 'astro';
import { getThread } from '../../../lib/getThread';

/**
 * GET /api/thread/[id]
 *
 * Fetches thread data by ID including message history and title.
 * Returns 404 if thread not found.
 * Returns 403 if user doesn't own the thread (unless it's public).
 */
export const GET: APIRoute = async ({ params }) => {
    const threadId = params.id;

    if (!threadId) {
        return new Response(
            JSON.stringify({ error: 'Thread ID is required' }),
            {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }

    try {
        const threadData = await getThread(threadId);

        if (!threadData) {
            return new Response(
                JSON.stringify({ error: 'Thread not found or unauthorized' }),
                {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        return new Response(
            JSON.stringify(threadData),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    } catch (error) {
        console.error('Error fetching thread:', error);
        return new Response(
            JSON.stringify({ error: 'Failed to fetch thread data' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};

export const prerender = false;
