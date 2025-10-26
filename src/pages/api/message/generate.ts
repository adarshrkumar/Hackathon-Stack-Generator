/**
 * Message Generation API Route
 *
 * This API endpoint handles AI message generation requests for the Stack Generator application.
 * It manages the complete conversation flow including:
 * - Thread creation and retrieval
 * - Conversation history management
 * - AI response generation via AWS Bedrock
 * - Conversation title generation
 * - Persistent storage in DynamoDB
 *
 * Endpoint: POST /api/message/generate
 *
 * Request Body:
 * {
 *   text: string,     // User's message
 *   id?: string       // Optional thread ID (creates new thread if omitted)
 * }
 *
 * Response:
 * {
 *   generatedText: string,  // AI-generated response
 *   generatedTitle: string, // Conversation title
 *   id: string              // Thread ID
 * }
 */

// Import Astro API route type
import type { APIRoute } from 'astro';

// Import application configuration
import config from '../../../lib/config';

// Import nanoid for generating unique thread IDs
import { nanoid } from 'nanoid';

// Import Bedrock AI functions
import { invokeBedrockLlama, generateConversationTitle } from '../../../lib/bedrock';

// Import type definitions
import type { Message } from '../../../lib/types';

// Import DynamoDB functions and Thread type
import { createThread, getThread, updateThread, type Thread } from '../../../lib/dynamodb';

/**
 * POST Request Handler
 *
 * Handles POST requests to generate AI responses and manage conversation threads.
 */
export const POST: APIRoute = async ({ request }) => {
    // Generate a unique ID for request tracking and logging
    const requestId = nanoid();

    // Record start time for performance monitoring
    const startTime = Date.now();

    try {
        /**
         * Parse Request Body
         *
         * Extract the user's message (text) and optional thread ID (id)
         * from the JSON request body
         */
        const { text: user_prompt, id: thread_id } = await request.json();

        // TODO: Use category and mode for context-specific prompts
        // This could be extended to support different system prompts based on use case

        /**
         * Thread ID Management
         *
         * Initialize thread ID variable to track the current conversation thread
         */
        let current_thread_id: string | undefined = thread_id;

        /**
         * New Thread Flag
         *
         * Track whether this is a new conversation (true) or continuing
         * an existing one (false). This determines whether we create or update
         * the thread in DynamoDB.
         */
        let isNewThread = false;

        /**
         * Thread ID Generation (if needed)
         *
         * If no thread ID was provided in the request, this is a new conversation.
         * Generate a unique ID using nanoid for the new thread.
         */
        if (!current_thread_id) {
            try {
                // Generate a unique thread identifier
                const newThreadId = nanoid();

                // Validate that nanoid successfully generated an ID
                if (!newThreadId) {
                    console.error(`❌ [${requestId}] Failed to generate thread ID`);
                    throw new Error('Failed to generate thread ID');
                }

                console.log(`🆕 [${requestId}] Creating new thread with ID: ${newThreadId}`);

                // Set the current thread ID and mark as new thread
                current_thread_id = newThreadId;
                isNewThread = true;
            } catch (error) {
                // Log thread generation error
                console.error(`❌ [${requestId}] Error generating thread:`, error);

                // Return error response
                return new Response(
                    JSON.stringify({ error: `Failed to generate thread: ${error}` }),
                    {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' },
                    }
                );
            }
        }

        /**
         * System Prompt Setup
         *
         * Get the system prompt from configuration. The system prompt establishes
         * the AI's behavior and persona for the entire conversation.
         */
        const systemPrompt = config.systemPrompt;

        /**
         * System Message Object
         *
         * Create the system message that will be prepended to every conversation.
         * This is always the first message sent to the AI model.
         */
        const systemObj = {
            role: 'system' as const,  // Type assertion for role
            content: systemPrompt,
        }

        /**
         * Conversation History Initialization
         *
         * Initialize the conversation history with the system message.
         * For existing threads, we'll load previous messages from DynamoDB.
         * For new threads, it starts with just the system message.
         */
        let convoHistory: Message[] = [systemObj as Message];

        /**
         * CONVERSATION HISTORY RETRIEVAL FROM DYNAMODB
         *
         * For existing threads, fetch the conversation history from DynamoDB
         * to maintain context across multiple requests.
         */
        let existingThread: Thread | null = null;

        if (current_thread_id && !isNewThread) {
            try {
                console.log(`🔍 [${requestId}] Fetching thread from DynamoDB: ${current_thread_id}`);

                // Attempt to retrieve the thread from DynamoDB
                existingThread = await getThread(current_thread_id);

                if (existingThread) {
                    // Thread found - log details
                    console.log(`✅ [${requestId}] Thread found in DynamoDB:`, {
                        threadId: existingThread.id,
                        title: existingThread.title,
                        messageCount: existingThread.messages.length
                    });

                    /**
                     * Load Existing History
                     *
                     * Prepend system message to the stored conversation history
                     * (system message is added dynamically, not stored in DB)
                     */
                    convoHistory = [systemObj as Message, ...existingThread.messages];
                } else {
                    /**
                     * Thread Not Found
                     *
                     * If the thread ID doesn't exist in DynamoDB, treat this as
                     * a new thread (might happen if the thread was deleted)
                     */
                    console.log(`⚠️ [${requestId}] Thread not found in DynamoDB, treating as new thread: ${current_thread_id}`);
                    isNewThread = true;
                }
            } catch (error) {
                // Log and return error if DynamoDB fetch fails
                console.error(`❌ [${requestId}] Error fetching conversation history:`, error);
                return new Response(
                    JSON.stringify({ error: `Failed to fetch conversation history: ${error instanceof Error ? error.message : String(error)}` }),
                    {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' },
                    }
                );
            }
        } else if (isNewThread) {
            // Log for new thread creation
            console.log(`🆕 [${requestId}] New thread, starting with system message only`);
        }

        // --- Append new user message ---
        console.log(`➕ [${requestId}] Adding user message to conversation history`);
        convoHistory.push({ role: 'user', content: user_prompt });
        console.log(`📊 [${requestId}] Updated conversation history:`, {
            totalMessages: convoHistory.length,
            userMessageLength: user_prompt.length
        });

        // --- Send request to AWS Bedrock ---
        console.log(`🧠 [${requestId}] Starting AI text generation with AWS Bedrock`);
        const aiStartTime = Date.now();
        let generatedText = '';

        try {
            console.log(`📤 [${requestId}] Sending to Bedrock:`, {
                model: config.model,
                messageCount: convoHistory.length,
                firstMessageRole: convoHistory[0]?.role,
                lastMessageRole: convoHistory[convoHistory.length - 1]?.role,
            });

            generatedText = await invokeBedrockLlama(convoHistory as Message[], config.model, 2048);

            const aiEndTime = Date.now();
            const aiDuration = aiEndTime - aiStartTime;

            console.log(`✅ [${requestId}] AI generation completed:`, {
                duration: `${aiDuration}ms`,
                generatedTextLength: generatedText.length,
                generatedTextPreview: generatedText.substring(0, 200) + (generatedText.length > 200 ? '...' : ''),
            });
        } catch (error) {
            const aiEndTime = Date.now();
            const aiDuration = aiEndTime - aiStartTime;
            console.error(`❌ [${requestId}] AI generation failed after ${aiDuration}ms:`, error);
            console.error(`❌ [${requestId}] AI error details:`, {
                errorName: error instanceof Error ? error.name : 'Unknown',
                errorMessage: error instanceof Error ? error.message : String(error),
                errorStack: error instanceof Error ? error.stack : 'No stack trace'
            });
            return new Response(
                JSON.stringify({ error: `Failed to generate AI response: ${error}` }),
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        // --- Append AI response to history ---
        console.log(`➕ [${requestId}] Adding AI response to conversation history`);
        convoHistory.push({ role: 'assistant', content: generatedText });

        // --- Generate conversation title ---
        let convoTitle = existingThread?.title || '';
        if (!convoTitle) {
            console.log(`🏷️ [${requestId}] Generating conversation title`);
            const titleStartTime = Date.now();
            try {
                convoTitle = await generateConversationTitle(convoHistory, config.model);
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

        // --- Save updated history back to DynamoDB ---
        console.log(`💾 [${requestId}] Saving conversation to DynamoDB`);
        const saveStartTime = Date.now();
        try {
            if (!current_thread_id) {
                throw new Error('Thread ID is null or undefined');
            }

            // Remove system message from stored history (we add it dynamically)
            const messagesToStore = convoHistory.filter(msg => msg.role !== 'system');

            if (isNewThread) {
                // Create new thread in DynamoDB
                console.log(`🆕 [${requestId}] Creating new thread in DynamoDB`);
                await createThread({
                    id: current_thread_id,
                    title: convoTitle,
                    messages: messagesToStore,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
            } else {
                // Update existing thread in DynamoDB
                console.log(`🔄 [${requestId}] Updating existing thread in DynamoDB`);
                await updateThread(
                    current_thread_id,
                    messagesToStore,
                    convoTitle
                );
            }

            const saveEndTime = Date.now();
            const saveDuration = saveEndTime - saveStartTime;
            console.log(`✅ [${requestId}] Conversation saved to DynamoDB:`, {
                duration: `${saveDuration}ms`,
                threadId: current_thread_id,
                messageCount: messagesToStore.length
            });
        } catch (error) {
            console.error(`❌ [${requestId}] Error saving conversation:`, error);
            return new Response(
                JSON.stringify({ error: `Failed to save conversation: ${error instanceof Error ? error.message : String(error)}` }),
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        // --- Prepare response ---
        const totalDuration = Date.now() - startTime;
        console.log(`🎉 [${requestId}] Request completed successfully:`, {
            totalDuration: `${totalDuration}ms`,
            threadId: current_thread_id,
            finalTitle: convoTitle,
            responseLength: generatedText.length
        });

        return new Response(
            JSON.stringify({
                generatedText: generatedText,
                generatedTitle: convoTitle,
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

export const prerender = false;