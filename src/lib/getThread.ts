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
    messages: Array<{ role: string; content: string | any }>;
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

        // Extract messages from thread data (excluding system messages, tool messages, and tool-call content)
        let messages: Array<{ role: string; content: any }> = [];
        if (
            thread.thread &&
            typeof thread.thread === 'object' &&
            'messages' in thread.thread &&
            Array.isArray((thread.thread as { messages: any[] }).messages)
        ) {
            // Process user/assistant messages and filter out tool-call portions from content
            messages = (thread.thread as { messages: any[] }).messages
                .filter((msg: any) => msg.role === 'user' || msg.role === 'assistant')
                .map((msg: any) => {
                    let content = msg.content;

                    // If content is an array, filter out tool-call items but keep array structure
                    if (Array.isArray(content)) {
                        content = content.filter((item: any) => item.type !== 'tool-call');

                        // If no content left after filtering, skip this message
                        if (content.length === 0) {
                            return null;
                        }
                    }

                    // If content is an object with type: "tool-call", skip this message
                    if (typeof content === 'object' && !Array.isArray(content) && content?.type === 'tool-call') {
                        return null;
                    }

                    return {
                        role: msg.role,
                        // Stringify content if it's an object/array (not a string)
                        content: typeof content === 'string' ? content : JSON.stringify(content)
                    };
                })
                .filter((msg): msg is { role: string; content: any } => msg !== null);
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
