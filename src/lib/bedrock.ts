import {
    BedrockRuntimeClient,
    InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import config from './config';
import type { Message } from './types';

// Initialize Bedrock client with credentials from environment
// Note: In Astro SSR, environment variables are available via import.meta.env
const credentials = {
    accessKeyId: import.meta.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: import.meta.env.AWS_SECRET_ACCESS_KEY || '',
};

const client = new BedrockRuntimeClient({
    region: import.meta.env.AWS_REGION || config.region || 'us-east-1',
    credentials: credentials,
});

/**
  * Invoke AWS Bedrock with Llama model
  * @param messages - Conversation history
  * @param modelId - Bedrock model ID (defaults to config model)
  * @param maxTokens - Maximum tokens to generate
  * @returns Generated text response
  */
export async function invokeBedrockLlama(
    messages: Message[],
    modelId: string = config.model,
    maxTokens: number = 2048
): Promise<string> {
    try {
        // Format messages for Llama prompt format
        const prompt = formatMessagesForLlama(messages);

        // Prepare the request payload for Llama models
        // Using AWS Bedrock defaults: temperature 0.5, top_p 0.9
        const requestBody = {
            prompt: prompt,
            max_gen_len: maxTokens,
            temperature: 0.5,  // Lower temperature reduces randomness and repetition
            top_p: 0.9
        };

        const command = new InvokeModelCommand({
            modelId: modelId,
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify(requestBody),
        });
        const response = await client.send(command);

        // Parse the response
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));

        // Extract the generated text
        const generatedText = responseBody.generation || responseBody.outputs?.[0]?.text || '';

        // Log for debugging
        console.log('Raw Bedrock response:', {
            generation: generatedText.substring(0, 200) + '...',
            stop_reason: responseBody.stop_reason,
            token_count: responseBody.generation_token_count
        });

        // Clean up Llama formatting tokens from the response
        return cleanLlamaResponse(generatedText);
    } catch (error) {
        console.error('Error invoking Bedrock:', error);
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
