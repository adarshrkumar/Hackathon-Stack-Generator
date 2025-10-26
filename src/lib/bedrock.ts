/**
 * AWS Bedrock Integration Module
 *
 * This module handles all interactions with AWS Bedrock Runtime API for AI text generation.
 * It specifically supports Meta's Llama language models with proper prompt formatting
 * and response parsing.
 *
 * Key Features:
 * - Bedrock client initialization with AWS credentials
 * - Llama-specific prompt formatting with special tokens
 * - Response cleaning and parsing
 * - Conversation title generation
 */

// Import AWS SDK components for Bedrock Runtime
import {
    BedrockRuntimeClient,    // Client for AWS Bedrock Runtime service
    InvokeModelCommand,      // Command to invoke AI models
} from '@aws-sdk/client-bedrock-runtime';

// Import application configuration
import config from './config';

// Import TypeScript type definitions
import type { Message } from './types';

/**
 * AWS Credentials Configuration
 *
 * Credentials are loaded from environment variables for security.
 * In Astro SSR mode, environment variables are accessed via import.meta.env
 *
 * Required environment variables:
 * - AWS_ACCESS_KEY_ID: Your AWS access key
 * - AWS_SECRET_ACCESS_KEY: Your AWS secret access key
 */
const credentials = {
    accessKeyId: import.meta.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: import.meta.env.AWS_SECRET_ACCESS_KEY || '',
};

/**
 * Bedrock Runtime Client Instance
 *
 * Initialized once and reused across invocations for efficiency.
 * Configured with the appropriate AWS region and credentials.
 */
const client = new BedrockRuntimeClient({
    // Use AWS_REGION from environment, fall back to config, then to us-east-1
    region: import.meta.env.AWS_REGION || config.region || 'us-east-1',
    credentials: credentials,
});

/**
 * Invoke AWS Bedrock with Llama Model
 *
 * This is the main function for generating AI responses using AWS Bedrock.
 * It handles the complete request-response cycle including:
 * - Formatting the conversation history for Llama
 * - Sending the request to AWS Bedrock
 * - Parsing and cleaning the response
 *
 * @param messages - Array of conversation messages (system, user, assistant)
 * @param modelId - Bedrock model identifier (defaults to config.model)
 * @param maxTokens - Maximum number of tokens to generate (default: 2048)
 * @returns The generated text response from the AI model
 * @throws Error if Bedrock invocation fails
 */
export async function invokeBedrockLlama(
    messages: Message[],
    modelId: string = config.model,
    maxTokens: number = 2048
): Promise<string> {
    try {
        // Format the messages array into Llama's expected prompt format
        // Llama models require special tokens like <|begin_of_text|>, <|start_header_id|>, etc.
        const prompt = formatMessagesForLlama(messages);

        /**
         * Request Body Configuration
         *
         * Configure the model parameters for generation:
         * - prompt: The formatted conversation prompt
         * - max_gen_len: Maximum tokens to generate
         * - temperature: Controls randomness (0.0 = deterministic, 1.0 = creative)
         *   Lower values (0.5) reduce repetition and increase consistency
         * - top_p: Nucleus sampling - considers tokens with cumulative probability up to p
         *   0.9 balances diversity and quality
         */
        const requestBody = {
            prompt: prompt,
            max_gen_len: maxTokens,
            temperature: 0.5,  // Lower temperature for more focused, consistent responses
            top_p: 0.9         // Nucleus sampling for balanced token selection
        };

        // Create the command to invoke the Bedrock model
        const command = new InvokeModelCommand({
            modelId: modelId,                    // The specific model to invoke
            contentType: 'application/json',     // Request format
            accept: 'application/json',          // Response format
            body: JSON.stringify(requestBody),   // Serialized request payload
        });

        // Send the command to AWS Bedrock and await the response
        const response = await client.send(command);

        // Decode and parse the binary response body into a JSON object
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));

        /**
         * Extract Generated Text
         *
         * Different Bedrock models may return text in different fields:
         * - generation: Standard field for Llama models
         * - outputs[0].text: Alternative field structure
         * Falls back to empty string if neither is present
         */
        const generatedText = responseBody.generation || responseBody.outputs?.[0]?.text || '';

        /**
         * Debug Logging
         *
         * Log response metadata for debugging and monitoring:
         * - First 200 characters of the generated text
         * - Stop reason (why generation ended)
         * - Token count (for usage tracking)
         */
        console.log('Raw Bedrock response:', {
            generation: generatedText.substring(0, 200) + '...',
            stop_reason: responseBody.stop_reason,
            token_count: responseBody.generation_token_count
        });

        // Clean up Llama-specific formatting tokens and extract the final response
        return cleanLlamaResponse(generatedText);
    } catch (error) {
        // Log the error for debugging
        console.error('Error invoking Bedrock:', error);

        // Throw a user-friendly error with the original error message
        throw new Error(`Bedrock invocation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Clean Llama formatting tokens from the generated response
 * Extracts only the assistant's response, removing conversation replay
 */
function cleanLlamaResponse(text: string): string {
    // Remove Llama special tokens
    let cleaned = text
        .replace(/<\|begin_of_text\|>/g, '')
        .replace(/<\|start_header_id\|>/g, '')
        .replace(/<\|end_header_id\|>/g, '')
        .replace(/<\|eot_id\|>/g, '');

    // Split by common conversation markers to find just the assistant's response
    // The model sometimes replays the conversation, so we need to extract the last part
    const conversationMarkers = [
        /Your last message was/i,
        /\buser\b\s*\n/i,
        /\bassistant\b\s*\n/i,
        /\bsystem\b\s*\n/i
    ];

    // Check if the response contains conversation replay
    let hasReplay = false;
    for (const marker of conversationMarkers) {
        if (marker.test(cleaned)) {
            hasReplay = true;
            break;
        }
    }

    // If there's conversation replay, try to extract just the final response
    if (hasReplay) {
        // Split on double newlines or conversation markers
        const parts = cleaned.split(/\n\n+/);
        // Take the last substantial part (more than 20 characters)
        for (let i = parts.length - 1; i >= 0; i--) {
            const part = parts[i].trim();
            if (part.length > 20 && !conversationMarkers.some(m => m.test(part))) {
                cleaned = part;
                break;
            }
        }
    }

    return cleaned.trim();
}

/**
 * Format messages array into Llama prompt format
 * Llama uses special tokens for conversation formatting
 */
function formatMessagesForLlama(messages: Message[]): string {
    let prompt = '';

    for (const message of messages) {
        if (message.role === 'system') {
            // System message format for Llama
            prompt += `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n${message.content}<|eot_id|>`;
        } else if (message.role === 'user') {
            // User message format
            prompt += `<|start_header_id|>user<|end_header_id|>\n\n${message.content}<|eot_id|>`;
        } else if (message.role === 'assistant') {
            // Assistant message format
            prompt += `<|start_header_id|>assistant<|end_header_id|>\n\n${message.content}<|eot_id|>`;
        }
    }

    // Add the assistant header to prompt for a response
    prompt += `<|start_header_id|>assistant<|end_header_id|>\n\n`;

    return prompt;
}

/**
 * Generate a concise title for a conversation
 */
export async function generateConversationTitle(
    messages: Message[],
    modelId: string = config.model
): Promise<string> {
    // Create a specific prompt for title generation
    const titleMessages: Message[] = [
        {
            role: 'system',
            content: 'You are a helpful assistant that generates concise, descriptive titles for conversations. Generate a title that is 3-7 words long and captures the main topic. Return only the title, nothing else.',
        },
        ...messages.filter(m => m.role !== 'system').slice(0, 4), // Include first few messages for context
        {
            role: 'user',
            content: 'Generate a concise title (3-7 words) for this conversation. Return only the title.',
        },
    ];

    const title = await invokeBedrockLlama(titleMessages, modelId, 100);

    // Clean up the title (remove quotes, extra whitespace, etc.)
    return title.replace(/^["']|["']$/g, '').trim();
}
