import type { APIRoute } from 'astro';
import config from '../../../lib/config';
import { nanoid } from 'nanoid';
import { invokeBedrockLlama, generateConversationTitle } from '../../../lib/bedrock';
import type { Message } from '../../../lib/types';
import { createThread, getThread, updateThread, type Thread } from '../../../lib/dynamodb';

export const POST: APIRoute = async ({ request }) => {
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
                const newThreadId = nanoid();
                if (!newThreadId) {
                    console.error(`❌ [${requestId}] Failed to generate thread ID`);
                    throw new Error('Failed to generate thread ID');
                }

                console.log(`🆕 [${requestId}] Creating new thread with ID: ${newThreadId}`);
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
        }

        const systemPrompt = config.systemPrompt;
        
        const systemObj = {
            role: 'system',
            content: systemPrompt,
        }
        
        let convoHistory: Message[] = [systemObj as Message];

        // --- Conversation History Fetch from DynamoDB ---
        let existingThread: Thread | null = null;
        if (current_thread_id && !isNewThread) {
            try {
                console.log(`🔍 [${requestId}] Fetching thread from DynamoDB: ${current_thread_id}`);
                existingThread = await getThread(current_thread_id);

                if (existingThread) {
                    console.log(`✅ [${requestId}] Thread found in DynamoDB:`, {
                        threadId: existingThread.id,
                        title: existingThread.title,
                        messageCount: existingThread.messages.length
                    });
                    // Load existing conversation history (excluding system prompt which we add separately)
                    convoHistory = [systemObj as Message, ...existingThread.messages];
                } else {
                    console.log(`⚠️ [${requestId}] Thread not found in DynamoDB, treating as new thread: ${current_thread_id}`);
                    isNewThread = true;
                }
            } catch (error) {
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