// @ts-check
// Enable TypeScript type checking for this configuration file

// Import Astro's configuration definition utility
import { defineConfig } from 'astro/config';

// Import the Vercel adapter for server-side rendering deployment
import vercel from '@astrojs/vercel';

/**
  * Astro Configuration File
  *
  * This configuration sets up BuildLoom for server-side rendering (SSR)
  * and deployment to Vercel. The SSR mode is essential for:
  * - Dynamic API routes that interact with Claude AI and PostgreSQL
  * - Real-time conversation handling without pre-rendering
  * - Server-side environment variable access for API credentials
  *
  * @see https://astro.build/config
  */
export default defineConfig({
    // Set output mode to 'server' for SSR (Server-Side Rendering)
    // This allows pages and API routes to be rendered on-demand rather than at build time
    output: 'server',

    // Use the Vercel adapter for deployment
    // This configures Astro to generate Vercel-compatible serverless functions
    adapter: vercel(),
});
