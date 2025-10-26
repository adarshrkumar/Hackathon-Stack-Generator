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
 * Create Thread
 *
 * Creates a new conversation thread in DynamoDB.
 * Automatically adds creation and update timestamps.
 *
 * @param thread - Thread object to create (id, title, messages, optionally userId)
 * @returns The created thread with timestamps
 * @throws Error if the DynamoDB operation fails
 */
export async function createThread(thread: Thread): Promise<Thread> {
    try {
        // Generate current timestamp in ISO 8601 format
        const timestamp = new Date().toISOString();

        /**
         * Prepare Thread Data
         *
         * Spread the input thread object and add timestamps
         * Both createdAt and updatedAt are set to the same timestamp on creation
         */
        const threadData = {
            ...thread,
            createdAt: timestamp,
            updatedAt: timestamp,
        };

        /**
         * Create DynamoDB Put Command
         *
         * PutCommand creates a new item in the table
         * If an item with the same key exists, it will be completely replaced
         */
        const command = new PutCommand({
            TableName: TABLE_NAME,  // Target table name
            Item: threadData,        // The item to store
        });

        // Send the command to DynamoDB
        await docClient.send(command);

        // Return the created thread data with timestamps
        return threadData;
    } catch (error) {
        // Log error for debugging
        console.error('Error creating thread in DynamoDB:', error);

        // Throw user-friendly error
        throw new Error(`Failed to create thread: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Get Thread by ID
 *
 * Retrieves a conversation thread from DynamoDB by its unique ID.
 * Optionally verifies user ownership if userId is provided.
 *
 * @param threadId - The unique thread identifier
 * @param userId - Optional user ID to verify ownership
 * @returns The thread object if found, null if not found
 * @throws Error if unauthorized access or DynamoDB operation fails
 */
export async function getThread(threadId: string, userId?: string): Promise<Thread | null> {
    try {
        /**
         * Create Get Command
         *
         * GetCommand retrieves a single item by its primary key
         */
        const command = new GetCommand({
            TableName: TABLE_NAME,  // Target table
            Key: {
                id: threadId,        // Partition key value
            },
        });

        // Send the command and get response
        const response = await docClient.send(command);

        /**
         * Check if Item Exists
         *
         * If the item doesn't exist, DynamoDB returns an empty response
         * Return null to indicate thread not found
         */
        if (!response.Item) {
            return null;
        }

        /**
         * Verify Ownership (if applicable)
         *
         * If userId is provided and the thread has a userId attribute,
         * verify that they match to prevent unauthorized access
         */
        if (userId && response.Item.userId && response.Item.userId !== userId) {
            throw new Error('Unauthorized access to thread');
        }

        // Cast response to Thread type and return
        return response.Item as Thread;
    } catch (error) {
        // Log error for debugging
        console.error('Error getting thread from DynamoDB:', error);

        // Throw user-friendly error
        throw new Error(`Failed to get thread: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Update Thread
 *
 * Updates an existing thread with new messages and optionally a new title.
 * Automatically updates the updatedAt timestamp.
 * Supports ownership verification for multi-user scenarios.
 *
 * @param threadId - The unique thread identifier to update
 * @param messages - The updated messages array (complete conversation history)
 * @param title - Optional new title for the thread
 * @param userId - Optional user ID to verify ownership before updating
 * @returns The updated thread object
 * @throws Error if unauthorized or DynamoDB operation fails
 */
export async function updateThread(
    threadId: string,
    messages: Message[],
    title?: string,
    userId?: string
): Promise<Thread> {
    try {
        // Generate current timestamp for the update
        const timestamp = new Date().toISOString();

        /**
         * Build Dynamic Update Expression
         *
         * DynamoDB UpdateCommand requires an UpdateExpression that specifies
         * which attributes to modify. We build this dynamically based on
         * whether a title is provided.
         */
        let updateExpression = 'SET messages = :messages, updatedAt = :updatedAt';

        /**
         * Expression Attribute Values
         *
         * Maps the placeholder values (:messages, :updatedAt, etc.)
         * in the UpdateExpression to actual values
         */
        const expressionAttributeValues: Record<string, any> = {
            ':messages': messages,     // The new messages array
            ':updatedAt': timestamp,   // Current timestamp
        };

        /**
         * Add Title Update (if provided)
         *
         * If a new title is provided, append it to the update expression
         * and add its value to the attribute values map
         */
        if (title) {
            updateExpression += ', title = :title';
            expressionAttributeValues[':title'] = title;
        }

        /**
         * Build Ownership Verification Condition
         *
         * If userId is provided, add a condition that ensures either:
         * 1. The thread has no userId (unowned thread), OR
         * 2. The thread's userId matches the provided userId
         *
         * This prevents unauthorized updates to other users' threads
         */
        const conditionExpression = userId ? 'attribute_not_exists(userId) OR userId = :userId' : undefined;
        if (userId) {
            expressionAttributeValues[':userId'] = userId;
        }

        /**
         * Create Update Command
         *
         * UpdateCommand modifies specific attributes of an existing item
         * without replacing the entire item
         */
        const command = new UpdateCommand({
            TableName: TABLE_NAME,                              // Target table
            Key: {
                id: threadId,                                    // Partition key
            },
            UpdateExpression: updateExpression,                 // What to update
            ExpressionAttributeValues: expressionAttributeValues, // Values to use
            ConditionExpression: conditionExpression,           // Update conditions
            ReturnValues: 'ALL_NEW',                            // Return updated item
        });

        // Send the command and get response
        const response = await docClient.send(command);

        // Return the updated thread (ALL_NEW returns the item after update)
        return response.Attributes as Thread;
    } catch (error) {
        // Log error for debugging
        console.error('Error updating thread in DynamoDB:', error);

        // Throw user-friendly error
        throw new Error(`Failed to update thread: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Get User Threads
 *
 * Retrieves all conversation threads for a specific user.
 * This function is designed for multi-user scenarios where each user
 * has multiple conversation threads.
 *
 * IMPORTANT: This function requires a Global Secondary Index (GSI) on the userId attribute.
 * The GSI should be named 'userId-index' with userId as the partition key.
 * See DYNAMODB_SETUP.md for instructions on creating the GSI.
 *
 * @param userId - The user ID to query threads for
 * @param limit - Maximum number of threads to return (default: 50)
 * @returns Array of threads owned by the user, sorted by newest first
 * @throws Error if DynamoDB operation fails (e.g., GSI doesn't exist)
 */
export async function getUserThreads(userId: string, limit: number = 50): Promise<Thread[]> {
    try {
        /**
         * Create Query Command
         *
         * QueryCommand allows efficient querying using indexes.
         * Unlike Scan (which reads entire table), Query uses an index
         * to retrieve only items matching the key condition.
         */
        const command = new QueryCommand({
            TableName: TABLE_NAME,                         // Target table
            IndexName: 'userId-index',                     // GSI to query (must exist!)
            KeyConditionExpression: 'userId = :userId',    // Query condition
            ExpressionAttributeValues: {
                ':userId': userId,                          // The user ID to match
            },
            Limit: limit,                                   // Max results to return
            ScanIndexForward: false,                        // false = newest first (descending sort)
        });

        // Send the command and get response
        const response = await docClient.send(command);

        // Return the items array (empty array if no items found)
        return (response.Items || []) as Thread[];
    } catch (error) {
        // Log error for debugging
        console.error('Error getting user threads from DynamoDB:', error);

        // Throw user-friendly error
        throw new Error(`Failed to get user threads: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Delete Thread
 *
 * Deletes a conversation thread from DynamoDB.
 * Optionally verifies user ownership before deletion.
 *
 * @param threadId - The unique thread identifier to delete
 * @param userId - Optional user ID to verify ownership before deletion
 * @throws Error if unauthorized or DynamoDB operation fails
 */
export async function deleteThread(threadId: string, userId?: string): Promise<void> {
    try {
        /**
         * Build Ownership Verification Condition
         *
         * If userId is provided, add a condition that ensures
         * the thread's userId matches before allowing deletion
         */
        const conditionExpression = userId ? 'userId = :userId' : undefined;
        const expressionAttributeValues = userId ? { ':userId': userId } : undefined;

        /**
         * Create Delete Command
         *
         * DeleteCommand removes an item from the table by its primary key
         */
        const command = new DeleteCommand({
            TableName: TABLE_NAME,                          // Target table
            Key: {
                id: threadId,                                // Partition key
            },
            ConditionExpression: conditionExpression,       // Delete conditions
            ExpressionAttributeValues: expressionAttributeValues, // Condition values
        });

        // Send the command (no response data needed for delete)
        await docClient.send(command);
    } catch (error) {
        // Log error for debugging
        console.error('Error deleting thread from DynamoDB:', error);

        // Throw user-friendly error
        throw new Error(`Failed to delete thread: ${error instanceof Error ? error.message : String(error)}`);
    }
}
