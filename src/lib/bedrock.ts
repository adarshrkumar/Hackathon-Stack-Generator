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
import type { ToolDefinition } from './mathTools';

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
  * @param tools - Optional array of tool definitions available to the model
  * @returns The generated text response from the AI model
  * @throws Error if Bedrock invocation fails
  */
export async function invokeBedrockLlama(
    messages: Message[],
    modelId: string = config.model,
    maxTokens: number = 2048,
    tools?: ToolDefinition[]
): Promise<string> {
    try {
        // Format the messages array into Llama's expected prompt format
        // Llama models require special tokens like <|begin_of_text|>, <|start_header_id|>, etc.
        const prompt = formatMessagesForLlama(messages, tools);

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
  * Clean Llama Response
  *
  * Removes Llama-specific formatting tokens and extracts the actual assistant response.
  * Llama models sometimes include special tokens or replay conversation history,
  * so this function cleans the response to return only the new generated content.
  *
  * @param text - Raw response text from the Llama model
  * @returns Cleaned response text without formatting tokens
  */
function cleanLlamaResponse(text: string): string {
    /**
      * Step 1: Remove Llama Special Tokens
      *
      * Llama models use special control tokens for conversation formatting:
      * - <|begin_of_text|>: Marks the start of text
      * - <|start_header_id|>: Marks the start of a role identifier
      * - <|end_header_id|>: Marks the end of a role identifier
      * - <|eot_id|>: End of turn marker
      *
      * These tokens are internal formatting and should not be shown to users
      */
    let cleaned = text
        .replace(/<\|begin_of_text\|>/g, '')      // Remove text beginning marker
        .replace(/<\|start_header_id\|>/g, '')    // Remove header start marker
        .replace(/<\|end_header_id\|>/g, '')      // Remove header end marker
        .replace(/<\|eot_id\|>/g, '');            // Remove end of turn marker

    /**
      * Step 2: Define Conversation Replay Detection Markers
      *
      * Sometimes the model includes conversation history in its response.
      * These regex patterns detect if the response contains replayed conversation.
      */
    const conversationMarkers = [
        /Your last message was/i,  // Explicit conversation reference
        /\buser\b\s*\n/i,          // User role marker followed by newline
        /\bassistant\b\s*\n/i,     // Assistant role marker followed by newline
        /\bsystem\b\s*\n/i         // System role marker followed by newline
    ];

    /**
      * Step 3: Check for Conversation Replay
      *
      * Test if any of the conversation markers are present in the cleaned text
      */
    let hasReplay = false;
    for (const marker of conversationMarkers) {
        if (marker.test(cleaned)) {
            hasReplay = true;
            break;
        }
    }

    /**
      * Step 4: Extract Final Response if Replay Detected
      *
      * If conversation replay is detected, extract only the final assistant response
      * by splitting on double newlines and taking the last substantial segment
      */
    if (hasReplay) {
        // Split the response into segments separated by double newlines
        const parts = cleaned.split(/\n\n+/);

        // Iterate backwards through parts to find the last substantial response
        // (more than 20 characters and doesn't contain conversation markers)
        for (let i = parts.length - 1; i >= 0; i--) {
            const part = parts[i].trim();

            // Check if this part is substantial and doesn't contain markers
            if (part.length > 20 && !conversationMarkers.some(m => m.test(part))) {
                cleaned = part;
                break;
            }
        }
    }

    // Return the cleaned response with leading/trailing whitespace removed
    return cleaned.trim();
}

/**
  * Format Messages for Llama Prompt
  *
  * Converts an array of Message objects into Llama's expected prompt format.
  * Llama models require specific special tokens to delineate different parts
  * of the conversation (system instructions, user messages, assistant responses).
  *
  * Llama Prompt Format Structure:
  * <|begin_of_text|><|start_header_id|>system<|end_header_id|>
  *
  * System instructions here<|eot_id|><|start_header_id|>user<|end_header_id|>
  *
  * User message here<|eot_id|><|start_header_id|>assistant<|end_header_id|>
  *
  * Assistant response here<|eot_id|>
  *
  * @param messages - Array of conversation messages to format
  * @param tools - Optional array of tool definitions available to the model
  * @returns Properly formatted prompt string for Llama models
  */
function formatMessagesForLlama(messages: Message[], tools?: ToolDefinition[]): string {
    // Initialize empty prompt string
    let prompt = '';

    // Iterate through each message and format according to its role
    for (const message of messages) {
        if (message.role === 'system') {
            /**
              * System Message Format
              *
              * System messages start with <|begin_of_text|> to mark conversation start
              * and include the system role header to establish AI behavior/context
              *
              * If tools are provided, append tool definitions to the system message
              */
            let systemContent = message.content;

            if (tools && tools.length > 0) {
                systemContent += '\n\n=== AVAILABLE TOOLS ===\n';
                systemContent += 'You have access to the following tools. To use a tool, respond with a JSON object in this exact format:\n';
                systemContent += '{"tool_use": {"name": "tool_name", "input": {"param1": value1, "param2": value2}}}\n\n';

                for (const tool of tools) {
                    systemContent += `Tool: ${tool.name}\n`;
                    systemContent += `Description: ${tool.description}\n`;
                    systemContent += `Input Schema: ${JSON.stringify(tool.input_schema, null, 2)}\n\n`;
                }

                systemContent += 'IMPORTANT: Only use tools when necessary for calculations or tasks you cannot perform directly. When using a tool, respond ONLY with the JSON object, nothing else. After receiving the tool result, provide your final answer to the user.\n';
            }

            prompt += `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n${systemContent}<|eot_id|>`;

        } else if (message.role === 'user') {
            /**
              * User Message Format
              *
              * User messages include the user role header and the user's input
              */
            prompt += `<|start_header_id|>user<|end_header_id|>\n\n${message.content}<|eot_id|>`;

        } else if (message.role === 'assistant') {
            /**
              * Assistant Message Format
              *
              * Previous assistant messages in the conversation history
              * This maintains conversation context for multi-turn dialogues
              */
            prompt += `<|start_header_id|>assistant<|end_header_id|>\n\n${message.content}<|eot_id|>`;
        }
    }

    /**
      * Prompt for New Response
      *
      * Add the assistant header at the end to signal the model
      * to generate a new assistant response. The model will complete
      * this started assistant turn with its response.
      */
    prompt += `<|start_header_id|>assistant<|end_header_id|>\n\n`;

    return prompt;
}

/**
  * Generate Conversation Title
  *
  * Generates a concise, descriptive title for a conversation based on the first
  * few messages. This is useful for creating thread titles in the chat interface.
  *
  * The function:
  * 1. Creates a specialized prompt asking for title generation
  * 2. Includes the first few messages as context
  * 3. Requests a 3-7 word title from the model
  * 4. Cleans up the response (removes quotes, whitespace)
  *
  * @param messages - The conversation messages to generate a title from
  * @param modelId - The Bedrock model to use (defaults to config.model)
  * @returns A concise conversation title (3-7 words)
  */
export async function generateConversationTitle(
    messages: Message[],
    modelId: string = config.model
): Promise<string> {
    /**
      * Construct Title Generation Prompt
      *
      * Create a specific message array for title generation that:
      * - Uses a system message to instruct the model on title generation
      * - Includes first 4 non-system messages for context
      * - Explicitly requests a concise title in the final user message
      */
    const titleMessages: Message[] = [
        {
            role: 'system',
            // Specialized system prompt for title generation task
            content: 'You are a helpful assistant that generates concise, descriptive titles for conversations. Generate a title that is 3-7 words long and captures the main topic. Return only the title, nothing else.',
        },
        // Include first few messages (up to 4) for context, excluding system messages
        ...messages.filter(m => m.role !== 'system').slice(0, 4),
        {
            role: 'user',
            // Explicit instruction to generate title only
            content: 'Generate a concise title (3-7 words) for this conversation. Return only the title.',
        },
    ];

    /**
      * Generate Title
      *
      * Invoke Bedrock with a low token limit (100) since we only need
      * a short title, not a full conversation response
      */
    const title = await invokeBedrockLlama(titleMessages, modelId, 100);

    /**
      * Clean Up Title
      *
      * Remove surrounding quotes (single or double) that the model might include
      * and trim any extra whitespace for a clean title string
      */
    return title.replace(/^["']|["']$/g, '').trim();
}

/**
  * Parse Tool Call from Response
  *
  * Detects if the AI response contains a tool call and extracts the tool information.
  * Tool calls are expected in JSON format: {"tool_use": {"name": "tool_name", "input": {...}}}
  *
  * @param response - The AI's response text
  * @returns Object containing whether a tool was called, the tool name, input, and remaining text
  */
export function parseToolCall(response: string): {
    isToolCall: boolean;
    toolName?: string;
    toolInput?: any;
    remainingText?: string;
} {
    try {
        // Try to find JSON object in the response
        const jsonMatch = response.match(/\{[\s\S]*"tool_use"[\s\S]*\}/);

        if (!jsonMatch) {
            return { isToolCall: false };
        }

        // Parse the JSON
        const parsed = JSON.parse(jsonMatch[0]);

        if (parsed.tool_use && parsed.tool_use.name) {
            // Extract text before and after the tool call
            const beforeTool = response.substring(0, jsonMatch.index || 0).trim();
            const afterTool = response.substring((jsonMatch.index || 0) + jsonMatch[0].length).trim();
            const remainingText = (beforeTool + ' ' + afterTool).trim();

            return {
                isToolCall: true,
                toolName: parsed.tool_use.name,
                toolInput: parsed.tool_use.input,
                remainingText: remainingText || undefined
            };
        }

        return { isToolCall: false };
    } catch (error) {
        // If JSON parsing fails, it's not a valid tool call
        return { isToolCall: false };
    }
}
