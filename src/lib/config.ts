/**
  * Application Configuration
  */

import { anthropic } from '@ai-sdk/anthropic';

import tools from './tools'
import systemPrompt from './prompt';

// Cache for the model ID to avoid repeated API calls
let cachedModelID: string | null = null;

async function getAnthropicModelID(modelName: string): Promise<string> {
    if (cachedModelID) return cachedModelID;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return '';

    try {
        const resp = await fetch('https://api.anthropic.com/v1/models', {
            method: 'GET',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            }
        });
        const modelsData = (await resp.json())?.data;
        const modelID = modelsData?.find((model: any) => model.display_name.toLowerCase().includes(modelName.toLowerCase()))?.id;

        if (modelID) {
            cachedModelID = modelID;
            return modelID;
        }
    } catch (error) {
        console.error('Failed to fetch Anthropic model ID:', error);
    }

    return '';
}

const config = {
    testingEmail: 'testing123@buildloom.ai',
    provider: 'anthropic',
    providerFunction: anthropic,
    model: 'claude-sonnet-4.5', // Use model name directly; getAnthropicModelID can be called separately if needed
    systemPrompt,
    tools,
    maxThreadsPerUser: 5, // Maximum number of threads a user can create
    getAnthropicModelID, // Export for use elsewhere if needed
};

export default config;