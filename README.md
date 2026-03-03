# BuildLoom

An AI-powered tech stack recommendation engine built with Astro.

This project is an Astro-based SSR application that integrates with Anthropic's Claude AI via the Vercel AI SDK for intelligent conversations and uses PostgreSQL with Drizzle ORM for persistent conversation threads. Styling is implemented using SCSS.

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
- `src/lib/` - AI config, database helpers, utilities and types
- `src/layouts/` - `Layout.astro` (marketing) and `App.astro` (app)
- `src/components/` - reusable components
- `src/styles/` - SCSS variables, components, layouts, pages
- `src/db/` - Drizzle ORM schema and initialization

## Anthropic Claude AI integration

- Model: `claude-sonnet-4.5` (configured in `src/lib/config.ts`)
- SDK: Vercel AI SDK (`ai` v5.0.81) with `@ai-sdk/anthropic`
- Main chat endpoint: `src/pages/api/message/generate.ts`
- Tools: Dynamic tool loading system in `src/lib/tools/`

## PostgreSQL with Drizzle ORM

Conversation threads are stored in PostgreSQL.

- Database: Vercel Postgres
- ORM: Drizzle ORM v0.44.7
- Tables: `threads`, `mega_list`, `company_info`
- Primary key: `id` (text)
- Attributes: `title`, `thread` (JSONB), `email`, `isPublic`, `isDev`, timestamps

See `src/db/schema.ts` for schema definitions.

## Environment variables

Create a `.env` file (or set env vars in deployment) with these values:

- `ANTHROPIC_API_KEY` - Anthropic API key for Claude access
- `EXA_SEARCH_API_KEY` - Exa search API key for web search
- `POSTGRES_URL` - PostgreSQL connection string
- Or individual: `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`

Other configuration values (model, system prompts) live in `src/lib/config.ts`.

## Styling

- SCSS with a modular structure: `src/styles/variables`, `components`, `layouts`, `pages`.
- Global tokens: `src/styles/variables/globals.scss` and `colors.scss`.

## Where to look next

- AI integration: `src/lib/config.ts`
- Chat API: `src/pages/api/message/generate.ts`
- Database schema: `src/db/schema.ts`
- App layout: `src/layouts/App.astro` (includes Font Awesome CDN)
- Tools system: `src/lib/tools.ts` and `src/lib/tools/*.ts`
