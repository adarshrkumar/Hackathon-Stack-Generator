export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface BedrockResponse {
    generation: string;
    prompt_token_count?: number;
    generation_token_count?: number;
    stop_reason?: string;
}
