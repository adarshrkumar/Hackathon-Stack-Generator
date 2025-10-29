/*
 * Application Configuration
 */

import { anthropic } from '@ai-sdk/anthropic';

import tools from './tools'
import systemPrompt from './prompt';

async function getAnthropicModelID(modelName: string): Promise<string> {
    const resp = await fetch('https://api.anthropic.com/v1/models', {
        method: 'GET',
        headers: { 
            'x-api-key': process.env.ANTHROPIC_API_KEY || import.meta.env.ANTHROPIC_API_KEY || '',
            'anthropic-version': '2023-06-01'
        }
    });
    const modelsData = (await resp.json())?.data;

    const modelID = modelsData?.find((model: any) => model.display_name.toLowerCase().includes(modelName.toLowerCase()))//?.id;
    if (!modelID) {
        return ''
    }
    return modelID;
}

const config = {
    testingEmail: 'testing123@stack.generator',
    provider: 'anthropic',
    providerFunction: anthropic,
    model: await getAnthropicModelID('Sonnet 4.5'),
    systemPrompt,
    tools,
    maxThreadsPerUser: 5, // Maximum number of threads a user can create
};

export default config;