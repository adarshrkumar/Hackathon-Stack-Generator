/**
  * Thread Fetching Utility
  *
  * Provides a function to fetch thread data from the database
  * Used for server-side rendering of chat history
  */

import { db } from '../db/initialize';
import { eq } from 'drizzle-orm';
import { threadsTable } from '../db/schema';
import config from './config';

export interface ThreadData {
    id: string;
    title: string;
    messages: Array<{ role: string; content: string }>;
}

/**
  * Fetch thread data by ID
  *
  * @param threadId - The thread ID to fetch
  * @param userEmail - The user's email for ownership verification (optional, uses test email by default)
  * @returns Thread data or null if not found/unauthorized
  */
export async function getThread(
    threadId: string,
    userEmail: string = config.testingEmail
): Promise<ThreadData | null> {
    if (!threadId) {
        return null;
    }

    try {
        const threads = await db.select().from(threadsTable).where(eq(threadsTable.id, threadId));

        if (threads.length === 0) {
            console.log(`Thread not found: ${threadId}`);
            return null;
        }

        const thread = threads[0];

        // Check thread ownership (unless it's public)
        if (!thread.isPublic && thread.email && thread.email !== userEmail) {
            console.log(`Unauthorized access attempt to thread: ${threadId}`);
            return null;
        }

        // Extract messages from thread data (excluding system messages and tool results)
        let messages: Array<{ role: string; content: string }> = [];
        if (
            thread.thread &&
            typeof thread.thread === 'object' &&
            'messages' in thread.thread &&
            Array.isArray((thread.thread as { messages: any[] }).messages)
        ) {
            // Filter out system messages and tool-result messages to only return user/assistant messages
            messages = (thread.thread as { messages: any[] }).messages.filter(
                (msg: any) =>
                    (msg.role === 'user' || msg.role === 'assistant') &&
                    msg.type !== 'tool-result'
            );
        }

        return {
            id: thread.id,
            title: thread.title || '',
            messages: messages,
        };
    } catch (error) {
        console.error('Error fetching thread:', error);
        return null;
    }
}
