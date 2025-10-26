/**
 * AWS DynamoDB Integration Module
 *
 * This module handles all database operations for storing and retrieving
 * conversation threads in Amazon DynamoDB. It provides CRUD operations
 * for thread management with support for multi-user scenarios.
 *
 * Key Features:
 * - Thread creation and retrieval
 * - Message history storage and updates
 * - User ownership verification
 * - Multi-user support via Global Secondary Index (GSI)
 *
 * Database Schema:
 * - Partition Key: id (thread identifier)
 * - Attributes: userId, title, messages[], createdAt, updatedAt
 * - Optional GSI: userId-index for querying user's threads
 */

// Import DynamoDB client and document client
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

// Import DynamoDB Document Client and command types
// Document Client provides a simplified interface for working with DynamoDB items as JSON
import {
    DynamoDBDocumentClient,  // Wrapper for easier JSON handling
    PutCommand,              // Create new items
    GetCommand,              // Retrieve items by key
    UpdateCommand,           // Update existing items
    QueryCommand,            // Query with conditions (requires indexes)
    DeleteCommand,           // Delete items
} from '@aws-sdk/lib-dynamodb';

// Import Message type definition
import type { Message } from './types';

/**
 * DynamoDB Client Initialization
 *
 * The base DynamoDB client for connecting to AWS DynamoDB service.
 * Configured with AWS credentials from environment variables.
 */
const client = new DynamoDBClient({
    // AWS region for DynamoDB service (defaults to us-east-1)
    region: import.meta.env.AWS_REGION || 'us-east-1',

    // AWS credentials for authentication
    credentials: {
        accessKeyId: import.meta.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: import.meta.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

/**
 * DynamoDB Document Client
 *
 * The Document Client wraps the base DynamoDB client and provides
 * automatic marshalling/unmarshalling of JavaScript objects to DynamoDB format.
 * This allows us to work with native JavaScript types instead of DynamoDB's
 * AttributeValue format.
 */
const docClient = DynamoDBDocumentClient.from(client);

/**
 * DynamoDB Table Name
 *
 * The name of the DynamoDB table storing conversation threads.
 * Can be configured via DYNAMODB_TABLE_NAME environment variable.
 * Defaults to 'threads' if not specified.
 */
const TABLE_NAME = import.meta.env.DYNAMODB_TABLE_NAME || 'threads';

/**
 * Thread Interface
 *
 * Represents a conversation thread stored in DynamoDB.
 * Each thread contains the conversation history, metadata, and ownership information.
 */
export interface Thread {
    /**
     * Unique thread identifier
     * This is the partition key in DynamoDB and must be unique across all threads
     */
    id: string;

    /**
     * Optional user identifier
     * Used for multi-user support to track thread ownership
     * Can be used with a GSI (Global Secondary Index) to query all threads for a user
     */
    userId?: string;

    /**
     * Thread title
     * A concise, descriptive title generated from the conversation content
     */
    title: string;

    /**
     * Conversation messages
     * Array of all messages in the thread (system, user, assistant)
     * Stored as a list attribute in DynamoDB
     */
    messages: Message[];

    /**
     * Creation timestamp
     * ISO 8601 formatted string indicating when the thread was created
     */
    createdAt: string;

    /**
     * Last update timestamp
     * ISO 8601 formatted string indicating when the thread was last modified
     */
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
