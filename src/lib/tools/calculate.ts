import { tool } from 'ai';
import { z } from 'zod';

/**
 * Calculate Tool
 *
 * Performs mathematical calculations with various operations.
 * Supports: add, subtract, multiply, divide, power, sqrt, modulo, abs, ceil, floor, round
 */
const calculateTool = tool({
    description: 'Performs mathematical calculations. Use this tool when you need to compute accurate arithmetic results. Supports operations: add, subtract, multiply, divide, power, sqrt, modulo, abs, ceil, floor, round.',
    parameters: z.object({
            operation: z.enum([
                'add', 'subtract', 'multiply', 'divide',
                'power', 'sqrt', 'modulo', 'abs',
                'ceil', 'floor', 'round'
            ]).describe('The mathematical operation to perform'),
            a: z.number().describe('The first operand (or the only operand for unary operations like sqrt, abs, ceil, floor, round)'),
            b: z.number().optional().describe('The second operand (required for binary operations like add, subtract, multiply, divide, power, modulo)')
        }),
        execute: async ({ operation, a, b }) => {
            try {
                let result: number;
                let op = operation.toLowerCase();

                const operationReplacements = {
                    '+': 'add',
                    '-': 'subtract',
                    '*': 'multiply',
                    '/': 'divide',
                    '^': 'power',
                    '√': 'sqrt',
                    '%': 'modulo'
                }

                if (operationReplacements[op as keyof typeof operationReplacements]) {
                    op = operationReplacements[op as keyof typeof operationReplacements];
                }

                switch (op) {
                    case 'add':
                        if (b === undefined) throw new Error('Addition requires two operands');
                        result = a + b;
                        break;

                    case 'subtract':
                        if (b === undefined) throw new Error('Subtraction requires two operands');
                        result = a - b;
                        break;

                    case 'multiply':
                        if (b === undefined) throw new Error('Multiplication requires two operands');
                        result = a * b;
                        break;

                    case 'divide':
                        if (b === undefined) throw new Error('Division requires two operands');
                        if (b === 0) throw new Error('Division by zero is not allowed');
                        result = a / b;
                        break;

                    case 'power':
                        if (b === undefined) throw new Error('Power operation requires two operands');
                        result = Math.pow(a, b);
                        break;

                    case 'sqrt':
                        if (a < 0) throw new Error('Cannot calculate square root of negative number');
                        result = Math.sqrt(a);
                        break;

                    case 'modulo':
                        if (b === undefined) throw new Error('Modulo requires two operands');
                        if (b === 0) throw new Error('Modulo by zero is not allowed');
                        result = a % b;
                        break;

                    case 'abs':
                        result = Math.abs(a);
                        break;

                    case 'ceil':
                        result = Math.ceil(a);
                        break;

                    case 'floor':
                        result = Math.floor(a);
                        break;

                    case 'round':
                        result = Math.round(a);
                        break;

                    default:
                        throw new Error(`Unknown operation: ${op}`);
                }

                return {
                    message: 'Calculation completed successfully',
                    result: {
                        success: true,
                        result: result,
                        operation: op
                    }
                };
            } catch (error) {
                return {
                    message: 'Calculation failed',
                    result: {
                        success: false,
                        error: error instanceof Error ? error.message : String(error),
                        operation: operation
                    }
                };
            }
        },
});

export default calculateTool;
