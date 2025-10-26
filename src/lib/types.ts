/**
 * Type Definitions for the Stack Generator Application
 *
 * This file contains TypeScript interfaces and types used throughout the application
 * for type safety and better IDE support.
 */

/**
 * Message Interface
 *
 * Represents a single message in a conversation thread.
 * Messages follow the standard chat format used by AI models:
 * - system: Instructions/context for the AI model
 * - user: Messages from the end user
 * - assistant: Responses from the AI model
 */
export interface Message {
    // The role of the message sender (system, user, or assistant)
    role: 'system' | 'user' | 'assistant';

    // The actual text content of the message
    content: string;
}

/**
 * Bedrock Response Interface
 *
 * Represents the response structure returned by AWS Bedrock Runtime API
 * when invoking a language model. This interface models the JSON response
 * from the Bedrock service.
 */
export interface BedrockResponse {
    // The generated text from the AI model
    generation: string;

    // Optional: Number of tokens in the prompt/input
    prompt_token_count?: number;

    // Optional: Number of tokens generated in the response
    generation_token_count?: number;

    // Optional: Reason why generation stopped (e.g., 'stop', 'length', 'content_filter')
    stop_reason?: string;
}
