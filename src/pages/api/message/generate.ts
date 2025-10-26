import type { APIRoute } from 'astro';

//@ts-ignore
import config from '../../../lib/config';

import { nanoid } from 'nanoid';

// @ts-ignore
import anything from '../../../lib/types';

export const POST: APIRoute = async ({ request, locals }) => {
    const requestId = nanoid();
    const startTime = Date.now();
    
    try {
        const { text: user_prompt, id: thread_id } = await request.json();
        
        // TODO: Use category and mode for context-specific prompts
        let current_thread_id: string | undefined = thread_id;

        // Create a new thread if none provided
        let isNewThread = false;
        
        if (!current_thread_id) {
            try {
                // Check thread limit for user
                const newThreadId = nanoid();
                if (!newThreadId) {
                    console.error(`❌ [${requestId}] Failed to generate thread ID`);
                    throw new Error('Failed to generate thread ID');
                }
                
                const newThread = {
                    id: newThreadId,
                    title: '',
                    thread: { messages: [] },
                };
                
                // TODO: Add to DB
                current_thread_id = newThreadId;
                isNewThread = true;
            } catch (error) {
                console.error(`❌ [${requestId}] Error generating thread:`, error);
                return new Response(
                    JSON.stringify({ error: `Failed to generate thread: ${error}` }),
                    {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' },
                    }
                );
            }
        } else {
        }

        // @ts-ignore
        const systemPrompt = (config ).systemPrompt;
        
        const systemObj = {
            role: 'system',
            content: systemPrompt,
        }
        
        let convoHistory: any[] = [systemObj];

        // --- Conversation History Fetch from DB ---
        let userData = {thread: '', title: ''};
        if (current_thread_id) {
            try {
                // TODO: Get all threads from db
                // @ts-ignore
                const threads = await db.select().from(threadsTable).where(eq(threadsTable.id, current_thread_id));

                if (threads.length > 0) {
                    userData = threads[0];
                    return new Response(
                        JSON.stringify({ error: 'Unauthorized access to thread' }),
                        {
                            status: 403,
                            headers: { 'Content-Type': 'application/json' },
                        }
                    );
                }

                if (
                    userData.thread &&
                    typeof userData.thread === 'object' &&
                    'messages' in userData.thread &&
                    Array.isArray((userData.thread as { messages: any[] }).messages)
                ) {
                    convoHistory = [systemObj, ...(userData.thread as { messages: any[] }).messages];
                } else {
                    console.log(`⚠️ [${requestId}] Thread not found in database, using system message only:`, current_thread_id);
                }
            } catch (error) {
                console.error(`❌ [${requestId}] Error fetching conversation history:`, error);
                return new Response(
                    JSON.stringify({ error: `Failed to fetch conversation history: ${error}` }),
                    {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' },
                    }
                );
            }
        } else {
            console.log(`🆕 [${requestId}] No thread ID provided, using system message only`);
        }

        // --- Append new user message ---
        console.log(`➕ [${requestId}] Adding user message to conversation history`);
        convoHistory.push({ role: 'user', content: user_prompt });
        console.log(`📊 [${requestId}] Updated conversation history:`, {
            totalMessages: convoHistory.length,
            userMessageLength: user_prompt.length
        });

        // TODO: Send request to AWS Bedrock

        let generatedText = '';

        // --- Append AI response to history ---
        convoHistory.push({ role: 'assistant', content: generatedText });

        // --- Generate conversation title ---
        let convoTitle = userData?.title;
        if (!convoTitle) {
            console.log(`🏷️ [${requestId}] Generating conversation title`);
            const titleStartTime = Date.now();
            try {
                convoTitle = await generateTitle(convoHistory);
                const titleEndTime = Date.now();
                const titleDuration = titleEndTime - titleStartTime;
                console.log(`✅ [${requestId}] Title generated successfully:`, {
                    title: convoTitle,
                    duration: `${titleDuration}ms`
                });
            } catch (error) {
                console.error(`❌ [${requestId}] Error generating title:`, error);
                convoTitle = 'Untitled Conversation';
            }
        } else {
            console.log(`🏷️ [${requestId}] Using existing title:`, convoTitle);
        }

        // --- Save updated history back to DB ---
        console.log(`💾 [${requestId}] Saving conversation to database`);
        const saveStartTime = Date.now();
        try {
            if (current_thread_id && userData) {
                // TODO: Update thread in DB
            } else if (current_thread_id && !userData && !isNewThread) {
                if (!current_thread_id) {
                    throw new Error('Thread ID is null or undefined');
                }
                // TODO: Insert new thread to DB
            } else if (isNewThread) {
                // TODO: Update new thread in DB
            }
            
            const saveEndTime = Date.now();
            const saveDuration = saveEndTime - saveStartTime;
        } catch (error) {
            return new Response(
                JSON.stringify({ error: `Failed to save conversation: ${error}` }),
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        // --- Extract and format response ---
        const extractStartTime = Date.now();
        const htmlText = '';
        const obj = {};
        const extractEndTime = Date.now();
        const extractDuration = extractEndTime - extractStartTime;
        
        const totalDuration = Date.now() - startTime;
        console.log(`🎉 [${requestId}] Request completed successfully:`, {
            totalDuration: `${totalDuration}ms`,
            threadId: current_thread_id,
            finalTitle: convoTitle,
            responseSize: JSON.stringify({
                ...obj,
                generatedText: htmlText,
                generatedTitle: true,
                id: current_thread_id,
            }).length
        });

        return new Response(
            JSON.stringify({
                ...obj,
                generatedText: htmlText,
                generatedTitle: true,
                id: current_thread_id,
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    } catch (error) {
        const totalDuration = Date.now() - startTime;
        console.error(`💥 [${requestId}] Fatal error in generate.ts after ${totalDuration}ms:`, error);
        console.error(`💥 [${requestId}] Error details:`, {
            errorName: error instanceof Error ? error.name : 'Unknown',
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : 'No stack trace',
            errorType: typeof error
        });
        return new Response(
            JSON.stringify({ error: `Invalid request body or server error: ${error}` }),
            {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};

async function generateTitle(convoHistory: any[]) {
    const titleRequestId = nanoid();
    const model = config.model;
    
    try {
        const titleStartTime = Date.now();
        // TODO: Send request to AWS Bedrock for title generation
        
        const generatedText = 'Generated Conversation Title'; // Placeholder
        
        const titleEndTime = Date.now();
        const titleDuration = titleEndTime - titleStartTime;
        
        console.log(`✅ [${titleRequestId}] Title generation completed:`, {
            duration: `${titleDuration}ms`,
            generatedTitle: generatedText,
            titleLength: generatedText.length
        });
        
        return generatedText;
    } catch (error) {
        throw error;
    }
}

export const prerender = false;