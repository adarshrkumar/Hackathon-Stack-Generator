import type { APIRoute } from 'astro';
import { db } from '../../../db/initialize';
import { eq } from 'drizzle-orm';
import { threadsTable } from '../../../db/schema';
import config from '../../../lib/config';

/**
 * GET /api/thread/[id]
 *
 * Fetches thread data by ID including message history and title.
 * Returns 404 if thread not found.
 * Returns 403 if user doesn't own the thread (unless it's public).
 */
export const GET: APIRoute = async ({ params, locals }) => {
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
        // Use hardcoded email for testing (same as generate.ts)
        const user_email = config.testingEmail;

        // Fetch thread from database
        const threads = await db.select().from(threadsTable).where(eq(threadsTable.id, threadId));

        if (threads.length === 0) {
            return new Response(
                JSON.stringify({ error: 'Thread not found' }),
                {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        const thread = threads[0];

        // Check thread ownership (unless it's public)
        if (!thread.isPublic && thread.email && thread.email !== user_email) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized access to thread' }),
                {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        // Extract messages from thread data (excluding system message)
        let messages: Array<{ role: string; content: string }> = [];
        if (
            thread.thread &&
            typeof thread.thread === 'object' &&
            'messages' in thread.thread &&
            Array.isArray((thread.thread as { messages: any[] }).messages)
        ) {
            // Filter out system messages to only return user/assistant messages
            messages = (thread.thread as { messages: any[] }).messages.filter(
                (msg: any) => msg.role === 'user' || msg.role === 'assistant'
            );
        }

        return new Response(
            JSON.stringify({
                id: thread.id,
                title: thread.title,
                messages: messages,
                createdAt: thread.createdAt,
                updatedAt: thread.updatedAt,
            }),
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
