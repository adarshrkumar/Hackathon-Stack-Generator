/**
  * Application Configuration
  *
  * Central configuration file for the Stack Generator application.
  * Contains settings for AWS Bedrock integration, model selection, and system prompts.
  */

/**
  * Default configuration object
  *
  * This object exports the core configuration values used throughout the application.
  * These values can be overridden by environment variables in the respective service files.
  */
export default {
     /**
      * System Prompt
      *
      * The default system prompt sent to the AI model to establish its behavior and persona.
      * This instructs the model on how to respond to user queries.
      *
      * Note: Context data from DynamoDB (company-info and web-services) will be appended
      * to this prompt dynamically in the API route.
      */
    systemPrompt: `You are a helpful AI assistant for the Stack Generator application.

You have access to information about companies and available web services. Use this information to provide accurate, relevant recommendations when helping users build their technology stacks.

When answering questions:
- Reference specific companies and services from the provided context when relevant
- Provide clear, accurate, and concise responses
- If asked about services or companies not in the context, acknowledge that and provide general guidance
- Focus on helping users make informed decisions about their technology choices`,

     /**
      * AI Model ID
      *
      * The AWS Bedrock model identifier for the Llama language model.
      * Format: 'us.meta.llama4-maverick-17b-instruct-v1:0'
      *
      * This specifies which AI model to use for generating responses.
      * Llama 4 Maverick 17B is optimized for instruction-following and conversational AI.
      */
    model: 'us.meta.llama4-maverick-17b-instruct-v1:0',

     /**
      * AWS Region
      *
      * The AWS region where Bedrock services are accessed.
      * us-east-1 (N. Virginia) is commonly used for Bedrock availability.
      *
      * This can be overridden by the AWS_REGION environment variable.
      */
    region: 'us-east-1',
};
