import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    UpdateCommand,
    QueryCommand,
    DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import type { Message } from './types';

// Initialize DynamoDB client
const client = new DynamoDBClient({
    region: import.meta.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: import.meta.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: import.meta.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

// Create DynamoDB Document client for easier JSON handling
const docClient = DynamoDBDocumentClient.from(client);

// Table name from environment or default
const TABLE_NAME = import.meta.env.DYNAMODB_TABLE_NAME || 'threads';

/**
 * Thread data structure stored in DynamoDB
 */
export interface Thread {
    id: string; // Partition key
    userId?: string; // Optional user ID for multi-user support
    title: string;
    messages: Message[];
    createdAt: string;
    updatedAt: string;
}

/**
 * Create a new thread in DynamoDB
 */
export async function createThread(thread: Thread): Promise<Thread> {
    try {
        const timestamp = new Date().toISOString();
        const threadData = {
            ...thread,
            createdAt: timestamp,
            updatedAt: timestamp,
        };

        const command = new PutCommand({
            TableName: TABLE_NAME,
            Item: threadData,
        });

        await docClient.send(command);
        return threadData;
    } catch (error) {
        console.error('Error creating thread in DynamoDB:', error);
        throw new Error(`Failed to create thread: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Get a thread by ID from DynamoDB
 */
export async function getThread(threadId: string, userId?: string): Promise<Thread | null> {
    try {
        const command = new GetCommand({
            TableName: TABLE_NAME,
            Key: {
                id: threadId,
            },
        });

        const response = await docClient.send(command);

        if (!response.Item) {
            return null;
        }

        // If userId is provided, verify ownership
        if (userId && response.Item.userId && response.Item.userId !== userId) {
            throw new Error('Unauthorized access to thread');
        }

        return response.Item as Thread;
    } catch (error) {
        console.error('Error getting thread from DynamoDB:', error);
        throw new Error(`Failed to get thread: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Update a thread with new messages and title
 */
export async function updateThread(
    threadId: string,
    messages: Message[],
    title?: string,
    userId?: string
): Promise<Thread> {
    try {
        const timestamp = new Date().toISOString();

        // Build update expression dynamically
        let updateExpression = 'SET messages = :messages, updatedAt = :updatedAt';
        const expressionAttributeValues: Record<string, any> = {
            ':messages': messages,
            ':updatedAt': timestamp,
        };

        if (title) {
            updateExpression += ', title = :title';
            expressionAttributeValues[':title'] = title;
        }

        // Add condition to check userId if provided
        const conditionExpression = userId ? 'attribute_not_exists(userId) OR userId = :userId' : undefined;
        if (userId) {
            expressionAttributeValues[':userId'] = userId;
        }

        const command = new UpdateCommand({
            TableName: TABLE_NAME,
            Key: {
                id: threadId,
            },
            UpdateExpression: updateExpression,
            ExpressionAttributeValues: expressionAttributeValues,
            ConditionExpression: conditionExpression,
            ReturnValues: 'ALL_NEW',
        });

        const response = await docClient.send(command);
        return response.Attributes as Thread;
    } catch (error) {
        console.error('Error updating thread in DynamoDB:', error);
        throw new Error(`Failed to update thread: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Get all threads for a user (optional - for multi-user support)
 */
export async function getUserThreads(userId: string, limit: number = 50): Promise<Thread[]> {
    try {
        // This requires a GSI (Global Secondary Index) on userId
        const command = new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'userId-index', // GSI name
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId,
            },
            Limit: limit,
            ScanIndexForward: false, // Sort by newest first
        });

        const response = await docClient.send(command);
        return (response.Items || []) as Thread[];
    } catch (error) {
        console.error('Error getting user threads from DynamoDB:', error);
        throw new Error(`Failed to get user threads: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Delete a thread from DynamoDB
 */
export async function deleteThread(threadId: string, userId?: string): Promise<void> {
    try {
        // Add condition to check userId if provided
        const conditionExpression = userId ? 'userId = :userId' : undefined;
        const expressionAttributeValues = userId ? { ':userId': userId } : undefined;

        const command = new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
                id: threadId,
            },
            ConditionExpression: conditionExpression,
            ExpressionAttributeValues: expressionAttributeValues,
        });

        await docClient.send(command);
    } catch (error) {
        console.error('Error deleting thread from DynamoDB:', error);
        throw new Error(`Failed to delete thread: ${error instanceof Error ? error.message : String(error)}`);
    }
}
