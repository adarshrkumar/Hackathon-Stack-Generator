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

        /**
         * ADD USER MESSAGE TO HISTORY
         *
         * Append the current user's message to the conversation history.
         * This will be sent to the AI model along with the rest of the history.
         */
        console.log(`➕ [${requestId}] Adding user message to conversation history`);
        convoHistory.push({ role: 'user', content: user_prompt });

        // Log updated conversation stats
        console.log(`📊 [${requestId}] Updated conversation history:`, {
            totalMessages: convoHistory.length,
            userMessageLength: user_prompt.length
        });

        /**
         * AI TEXT GENERATION WITH AWS BEDROCK
         *
         * This section handles the core AI interaction:
         * 1. Send the conversation history to AWS Bedrock
         * 2. Invoke the Llama model to generate a response
         * 3. Handle any errors that occur during generation
         */
        console.log(`🧠 [${requestId}] Starting AI text generation with AWS Bedrock`);
        const aiStartTime = Date.now();
        let generatedText = '';

        try {
            // Log request details for debugging
            console.log(`📤 [${requestId}] Sending to Bedrock:`, {
                model: config.model,
                messageCount: convoHistory.length,
                firstMessageRole: convoHistory[0]?.role,
                lastMessageRole: convoHistory[convoHistory.length - 1]?.role,
            });

            /**
             * Invoke Bedrock Llama
             *
             * Call the Bedrock API with:
             * - convoHistory: Complete conversation context
             * - config.model: The Llama model ID
             * - 2048: Max tokens to generate
             */
            generatedText = await invokeBedrockLlama(convoHistory as Message[], config.model, 2048);

            // Calculate and log performance metrics
            const aiEndTime = Date.now();
            const aiDuration = aiEndTime - aiStartTime;

            console.log(`✅ [${requestId}] AI generation completed:`, {
                duration: `${aiDuration}ms`,
                generatedTextLength: generatedText.length,
                generatedTextPreview: generatedText.substring(0, 200) + (generatedText.length > 200 ? '...' : ''),
            });
        } catch (error) {
            /**
             * AI Generation Error Handling
             *
             * If Bedrock fails to generate a response, log detailed error
             * information and return an error response to the client
             */
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

        /**
         * ADD AI RESPONSE TO HISTORY
         *
         * Append the AI-generated response to the conversation history.
         * This maintains the complete conversation context for future messages.
         */
        console.log(`➕ [${requestId}] Adding AI response to conversation history`);
        convoHistory.push({ role: 'assistant', content: generatedText });

        /**
         * CONVERSATION TITLE GENERATION
         *
         * Generate a descriptive title for the conversation (for new threads only).
         * Existing threads already have a title from their first message.
         */
        let convoTitle = existingThread?.title || '';

        if (!convoTitle) {
            /**
             * Generate New Title
             *
             * For new conversations, generate a concise title based on
             * the first exchange. This helps users identify conversations
             * in the thread list.
             */
            console.log(`🏷️ [${requestId}] Generating conversation title`);
            const titleStartTime = Date.now();

            try {
                // Generate title using AI (typically 3-7 words)
                convoTitle = await generateConversationTitle(convoHistory, config.model);

                // Log title generation performance
                const titleEndTime = Date.now();
                const titleDuration = titleEndTime - titleStartTime;

                console.log(`✅ [${requestId}] Title generated successfully:`, {
                    title: convoTitle,
                    duration: `${titleDuration}ms`
                });
            } catch (error) {
                /**
                 * Title Generation Fallback
                 *
                 * If title generation fails, use a default title
                 * This ensures the thread can still be saved
                 */
                console.error(`❌ [${requestId}] Error generating title:`, error);
                convoTitle = 'Untitled Conversation';
            }
        } else {
            // Use existing title for continuing conversations
            console.log(`🏷️ [${requestId}] Using existing title:`, convoTitle);
        }

        /**
         * SAVE CONVERSATION TO DYNAMODB
         *
         * Persist the updated conversation history to DynamoDB.
         * - For new threads: Create a new DynamoDB item
         * - For existing threads: Update the existing item
         */
        console.log(`💾 [${requestId}] Saving conversation to DynamoDB`);
        const saveStartTime = Date.now();

        try {
            // Validate thread ID before attempting to save
            if (!current_thread_id) {
                throw new Error('Thread ID is null or undefined');
            }

            /**
             * Prepare Messages for Storage
             *
             * Filter out the system message before storing.
             * We don't store system messages in DynamoDB because:
             * 1. They're static and can be added dynamically
             * 2. Saves storage space
             * 3. Allows updating system prompts without migrating data
             */
            const messagesToStore = convoHistory.filter(msg => msg.role !== 'system');

            if (isNewThread) {
                /**
                 * Create New Thread
                 *
                 * For new conversations, create a new item in DynamoDB
                 * with the thread ID, title, and initial messages
                 */
                console.log(`🆕 [${requestId}] Creating new thread in DynamoDB`);
                await createThread({
                    id: current_thread_id,
                    title: convoTitle,
                    messages: messagesToStore,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
            } else {
                /**
                 * Update Existing Thread
                 *
                 * For continuing conversations, update the existing DynamoDB item
                 * with the new messages and updated timestamp
                 */
                console.log(`🔄 [${requestId}] Updating existing thread in DynamoDB`);
                await updateThread(
                    current_thread_id,
                    messagesToStore,
                    convoTitle
                );
            }

            // Log save performance metrics
            const saveEndTime = Date.now();
            const saveDuration = saveEndTime - saveStartTime;

            console.log(`✅ [${requestId}] Conversation saved to DynamoDB:`, {
                duration: `${saveDuration}ms`,
                threadId: current_thread_id,
                messageCount: messagesToStore.length
            });
        } catch (error) {
            /**
             * Save Error Handling
             *
             * If we fail to save to DynamoDB, return an error response.
             * Note: The AI response was generated successfully, but persistence failed.
             */
            console.error(`❌ [${requestId}] Error saving conversation:`, error);
            return new Response(
                JSON.stringify({ error: `Failed to save conversation: ${error instanceof Error ? error.message : String(error)}` }),
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        /**
         * PREPARE SUCCESS RESPONSE
         *
         * Construct and return the successful API response containing:
         * - The AI-generated text
         * - The conversation title
         * - The thread ID (for subsequent requests)
         */
        const totalDuration = Date.now() - startTime;

        console.log(`🎉 [${requestId}] Request completed successfully:`, {
            totalDuration: `${totalDuration}ms`,
            threadId: current_thread_id,
            finalTitle: convoTitle,
            responseLength: generatedText.length
        });

        // Return JSON response with the generated content
        return new Response(
            JSON.stringify({
                generatedText: generatedText,    // AI's response message
                generatedTitle: convoTitle,       // Conversation title
                id: current_thread_id,            // Thread ID for future requests
            }),
            {
                status: 200,                      // HTTP 200 OK
                headers: { 'Content-Type': 'application/json' },
            }
        );

    } catch (error) {
        /**
         * TOP-LEVEL ERROR HANDLER
         *
         * Catches any unhandled errors in the request processing pipeline.
         * This includes:
         * - JSON parsing errors (malformed request body)
         * - Unexpected errors not caught by inner try-catch blocks
         * - Runtime errors
         */
        const totalDuration = Date.now() - startTime;

        console.error(`💥 [${requestId}] Fatal error in generate.ts after ${totalDuration}ms:`, error);
        console.error(`💥 [${requestId}] Error details:`, {
            errorName: error instanceof Error ? error.name : 'Unknown',
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : 'No stack trace',
            errorType: typeof error
        });

        // Return error response
        return new Response(
            JSON.stringify({ error: `Invalid request body or server error: ${error}` }),
            {
                status: 400,                      // HTTP 400 Bad Request
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};

/**
 * Disable Pre-rendering
 *
 * This route must NOT be pre-rendered during build time because:
 * 1. It handles dynamic POST requests
 * 2. It requires server-side AWS credentials
 * 3. It performs real-time AI generation
 *
 * Setting prerender = false ensures this route runs on the server
 * (via Vercel serverless function) rather than being statically generated.
 */
export const prerender = false;