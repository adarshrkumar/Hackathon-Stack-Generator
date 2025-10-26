/**
 * Math Tools Module
 *
 * Provides mathematical calculation functions that the AI can invoke
 * to perform accurate arithmetic operations.
 */

/**
 * Tool Definition Interface
 *
 * Defines the structure for tool schemas that the AI can call
 */
export interface ToolDefinition {
    name: string;
    description: string;
    input_schema: {
        type: string;
        properties: Record<string, any>;
        required: string[];
    };
}

/**
 * Math Tool Result Interface
 */
export interface MathToolResult {
    success: boolean;
    result?: number;
    error?: string;
    operation: string;
}

/**
 * Calculate Function
 *
 * Performs arithmetic calculations based on the provided operation and operands.
 *
 * @param operation - The mathematical operation (add, subtract, multiply, divide, power, sqrt, modulo)
 * @param a - First operand
 * @param b - Second operand (optional for unary operations like sqrt)
 * @returns Result of the calculation
 */
export function calculate(operation: string, a: number, b?: number): MathToolResult {
    try {
        let result: number;

        switch (operation.toLowerCase()) {
            case 'add':
            case 'addition':
            case '+':
                if (b === undefined) throw new Error('Addition requires two operands');
                result = a + b;
                break;

            case 'subtract':
            case 'subtraction':
            case '-':
                if (b === undefined) throw new Error('Subtraction requires two operands');
                result = a - b;
                break;

            case 'multiply':
            case 'multiplication':
            case '*':
            case 'x':
                if (b === undefined) throw new Error('Multiplication requires two operands');
                result = a * b;
                break;

            case 'divide':
            case 'division':
            case '/':
                if (b === undefined) throw new Error('Division requires two operands');
                if (b === 0) throw new Error('Division by zero is not allowed');
                result = a / b;
                break;

            case 'power':
            case 'exponent':
            case '^':
            case '**':
                if (b === undefined) throw new Error('Power operation requires two operands');
                result = Math.pow(a, b);
                break;

            case 'sqrt':
            case 'square_root':
                if (a < 0) throw new Error('Cannot calculate square root of negative number');
                result = Math.sqrt(a);
                break;

            case 'modulo':
            case 'mod':
            case '%':
                if (b === undefined) throw new Error('Modulo requires two operands');
                if (b === 0) throw new Error('Modulo by zero is not allowed');
                result = a % b;
                break;

            case 'abs':
            case 'absolute':
                result = Math.abs(a);
                break;

            case 'ceil':
            case 'ceiling':
                result = Math.ceil(a);
                break;

            case 'floor':
                result = Math.floor(a);
                break;

            case 'round':
                result = Math.round(a);
                break;

            default:
                throw new Error(`Unknown operation: ${operation}. Supported operations: add, subtract, multiply, divide, power, sqrt, modulo, abs, ceil, floor, round`);
        }

        return {
            success: true,
            result: result,
            operation: operation
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            operation: operation
        };
    }
}

/**
 * Math Tool Definition
 *
 * Tool schema that tells the AI how to use the math calculator
 */
export const mathToolDefinition: ToolDefinition = {
    name: 'calculate',
    description: 'Performs mathematical calculations. Use this tool when you need to compute accurate arithmetic results. Supports operations: add, subtract, multiply, divide, power, sqrt, modulo, abs, ceil, floor, round.',
    input_schema: {
        type: 'object',
        properties: {
            operation: {
                type: 'string',
                description: 'The mathematical operation to perform. Options: add, subtract, multiply, divide, power, sqrt, modulo, abs, ceil, floor, round',
                enum: ['add', 'subtract', 'multiply', 'divide', 'power', 'sqrt', 'modulo', 'abs', 'ceil', 'floor', 'round']
            },
            a: {
                type: 'number',
                description: 'The first operand (or the only operand for unary operations like sqrt, abs, ceil, floor, round)'
            },
            b: {
                type: 'number',
                description: 'The second operand (required for binary operations like add, subtract, multiply, divide, power, modulo)'
            }
        },
        required: ['operation', 'a']
    }
};

/**
 * Execute Tool
 *
 * Main function to execute a tool call based on the tool name and input
 *
 * @param toolName - Name of the tool to execute
 * @param toolInput - Input parameters for the tool
 * @returns Tool execution result
 */
export function executeTool(toolName: string, toolInput: any): MathToolResult {
    console.log(`🔧 Executing tool: ${toolName} with input:`, toolInput);

    if (toolName === 'calculate') {
        const { operation, a, b } = toolInput;
        const result = calculate(operation, a, b);
        console.log(`✅ Tool execution result:`, result);
        return result;
    }

    return {
        success: false,
        error: `Unknown tool: ${toolName}`,
        operation: 'unknown'
    };
}

/**
 * Update Thread Cost Tool Definition
 *
 * Tool schema that tells the AI how to update the cost for a thread
 */
export const updateCostToolDefinition: ToolDefinition = {
    name: 'update_thread_cost',
    description: 'Updates the total cost for a conversation thread in the database by adding the provided cost increment to the current cost value. Use this tool to track API usage costs.',
    input_schema: {
        type: 'object',
        properties: {
            threadId: {
                type: 'string',
                description: 'The unique identifier of the thread to update'
            },
            costIncrement: {
                type: 'number',
                description: 'The cost amount to add to the current thread cost (in dollars). This will be added to any existing cost value.'
            }
        },
        required: ['threadId', 'costIncrement']
    }
};

/**
 * Get All Tool Definitions
 *
 * Returns an array of all available tool definitions
 */
export function getAllToolDefinitions(): ToolDefinition[] {
    return [mathToolDefinition, updateCostToolDefinition];
}
