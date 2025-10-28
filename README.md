# Stack Generator

A concise README for the Stack Generator web application used in the SCU AWS Hackathon Project.

This project is an Astro-based SSR application that integrates with AWS Bedrock for AI-powered conversations and uses DynamoDB for persistent conversation threads. Styling is implemented using SCSS.

## Quick start

From the project root:

```bash
npm install
npm run dev       # start development server (localhost:4321)
npm run build     # build production site
npm run preview   # preview production build locally
```

## Important: Server-side Rendering (SSR)

This project is configured for SSR (see `astro.config.mjs` with `output: 'server'`). Pages and API routes that must be dynamic should opt out of prerendering:

```js
// at the top of the page or API route
export const prerender = false;
```

## Project layout (high level)

- `src/pages/` - file-based routing
  - Marketing pages: `index.astro`, `about.astro`, `contact.astro`
  - App pages: `app/index.astro`, `app/chat.astro`, `app/test.astro`
- `src/pages/api/` - server API routes (e.g., `api/message/generate.ts`)
- `src/lib/` - Bedrock client, DynamoDB helpers, config and types
- `src/layouts/` - `Layout.astro` (marketing) and `App.astro` (app)
- `src/components/` - reusable components
- `src/styles/` - SCSS variables, components, layouts, pages

## AWS Bedrock integration

- Model: `meta.llama3-1-70b-instruct-v1:0` (configured in `src/lib/config.ts`)
- Region: `us-east-1`
- SDK: `@aws-sdk/client-bedrock-runtime`
- Main chat endpoint: `src/pages/api/message/generate.ts`

## DynamoDB

Conversation threads are stored in DynamoDB.

- Default table name: `stack-generator-threads` (configurable via env)
- Primary key: `id` (String)
- Attributes: `userId`, `title`, `messages[]`, `createdAt`, `updatedAt`

See `src/lib/dynamodb.ts` for helper functions like `createThread`, `getThread`, and `updateThread`.

## Environment variables

Create a `.env` file (or set env vars in deployment) with these values:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION` (e.g. `us-east-1`)
- `DYNAMODB_TABLE_NAME` (e.g. `stack-generator-threads`)

Other configuration values (model, system prompts) live in `src/lib/config.ts`.

## Styling

- SCSS with a modular structure: `src/styles/variables`, `components`, `layouts`, `pages`.
- Global tokens: `src/styles/variables/globals.scss` and `colors.scss`.

## Where to look next

- AI integration: `src/lib/bedrock.ts`
- Chat API: `src/pages/api/message/generate.ts`
- DynamoDB helpers: `src/lib/dynamodb.ts`
- App layout: `src/layouts/App.astro` (includes Font Awesome CDN)

---

If you'd like, I can: add a sample `.env.example`, expand deployment notes for Vercel, or add a troubleshooting/dev checklist.
