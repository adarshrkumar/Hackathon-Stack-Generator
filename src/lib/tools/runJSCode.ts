import { tool } from 'ai';
import { z } from 'zod';

const runJSCodeTool = tool({
    description: 'Run JavaScript code',
    inputSchema: z.object({
        code: z.string().describe('The JavaScript code to run'),
    }),
    execute: async ({ code }: { code: string }) => {
            const lineReplacements = [
                {
                    func: 'startsWith',
                    key: 'import ',
                },
                {
                    func: 'includes',
                    key: 'import('
                }
            ]

            let ranCode = (code.includes('\n') ? code.split('\n') : [code])
                .map((line: string) => (
                    line.includes(';') ? line.split(';') : [line]
                ))
                .flat()
                .map((line: string) => (line.trim()))
                .map((line: string) => (
                    lineReplacements
                        .map(replacement => (
                            (line[replacement.func as keyof string] as Function)(replacement.key)
                        ))
                        .filter((replaced: boolean) => replaced).length < 1 ? line : null
                ))
                .filter((line: string | null) => line)

            const last = ranCode[ranCode.length - 1]
            if (last && !last.includes('return')) {
                ranCode[ranCode.length - 1] = 'return ' + last
            }
            const joinedCode = ranCode.join(';') || ''
    
            const codeResult = await Function(joinedCode)();
    
            const result = {
                codeResult,
                ranCode,
            }
    
            return { message: 'JavaScript code executed', result };
        },
});

export default runJSCodeTool;
