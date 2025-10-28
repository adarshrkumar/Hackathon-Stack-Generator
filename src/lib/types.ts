import type { Tool } from 'ai';

interface Category {
    name: string;
    description: string;
    modes: Record<string, Mode>;
}

interface Mode {
    name: string;
    description: string;
    icon?: string;
    prompt?: Promise<any>;
    tools?: Record<string, Tool>;
    show?: true | false;
}    

// Legacy Tool interface for backward compatibility
interface LegacyTool {
    type: 'function';
    ready: boolean;
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
    execute: (params: any) => Promise<any>;
}

export type { Mode, Category, LegacyTool, Tool };