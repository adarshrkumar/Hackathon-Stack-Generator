/*
 * Application Configuration
 */

import { anthropic } from '@ai-sdk/anthropic';

import tools from './tools'
import systemPrompt from './prompt';

const config = {
    provider: 'anthropic',
    providerFunction: anthropic,
    model: 'claude-sonnet-4.5',
    systemPrompt,
    tools,
    maxThreadsPerUser: 5, // Maximum number of threads a user can create
};

export default config;