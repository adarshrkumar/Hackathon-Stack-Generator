# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **Stack Generator** web application built for the SCU AWS Hackathon Project. It's an Astro-based application using server-side rendering (SSR) with Anthropic Claude AI integration (via Vercel AI SDK) for AI-powered tech stack recommendations. The app uses PostgreSQL with Drizzle ORM for data persistence, SCSS for styling, and is deployed on Vercel.

## Development Commands

Run all commands from the project root:

- `npm install` - Install dependencies
- `npm run dev` - Start development server at `localhost:4321`
- `npm run build` - Build production site for deployment
- `npm run preview` - Preview production build locally
- `npm run astro ...` - Run Astro CLI commands (e.g., `npm run astro add`, `npm run astro check`)

## Architecture

### Rendering Mode

**IMPORTANT**: This project uses **server-side rendering (SSR)**, not static site generation (SSG). The `astro.config.mjs` sets `output: 'server'` with the Vercel adapter. API routes and pages that need dynamic behavior must include `export const prerender = false;`.

### Project Structure

- **src/pages/** - File-based routing with two sections:
  - Marketing pages: `index.astro`, `about.astro`, `contact.astro`
  - App pages: `app/index.astro`, `app/chat.astro`
- **src/pages/api/** - API routes for backend functionality
  - `api/message/generate.ts` - Main AI chat endpoint (uses Anthropic Claude via Vercel AI SDK)
- **src/lib/** - Shared utilities and services
  - `config.ts` - Application configuration (model, system prompts, tools)
  - `prompt.ts` - System prompt for Stack Generator AI
  - `types.ts` - TypeScript interfaces (Tool, Category, Mode, etc.)
  - `tools.ts` - AI tools loader (dynamically imports all tools from `tools/`)
  - `tools/*.ts` - Individual AI tool implementations
- **src/db/** - Database layer
  - `schema.ts` - Drizzle ORM schema (threads, mega_list, company_info tables)
  - `initialize.ts` - Database client initialization
- **src/layouts/** - Page layouts (dual layout system)
  - `Layout.astro` - Marketing site layout (Header + Hero + Footer)
  - `App.astro` - Application layout (Nav + Footer, no Hero)
- **src/components/** - Reusable Astro components
  - Global: `Header.astro`, `Footer.astro`, `Hero.astro`, `FancyCard.astro`
  - App-specific: `app/Nav.astro`
- **src/styles/** - SCSS stylesheets organized by type:
  - `reset.scss` - CSS reset
  - `variables/` - SCSS variables (`globals.scss`, `colors.scss`)
  - `components/` - Component styles (including `app/` subfolder)
  - `layouts/` - Layout-specific styles (`Layout.scss`, `App.scss`)
  - `pages/` - Page-specific styles

### Dual Layout System

The project has two distinct layouts for different sections:

1. **Marketing Layout (`Layout.astro`)**:
   - Used for: homepage, about, contact pages
   - Includes: Header, Hero (homepage only), Footer
   - Title format: "Stack Generator" or "{title} | Stack Generator"
   - Imports: `reset.scss`, `Layout.scss`
   - Typography: Montserrat (Google Fonts)

2. **App Layout (`App.astro`)**:
   - Used for: `/app/*` pages (app interface)
   - Includes: Nav, Footer (no Hero)
   - Title format: "Stack Generator App" or "{title} | Stack Generator App"
   - Imports: `reset.scss`, `Layout.scss`, `App.scss`
   - Includes Font Awesome icons via CDN
   - Body has `class="app-layout"`, main has `class="main app"`
   - Typography: Montserrat (Google Fonts)

### AI Integration (Anthropic Claude via Vercel AI SDK)

The application uses Anthropic's Claude AI for generating tech stack recommendations:

- **Model**: Claude Sonnet 4.5 (`claude-sonnet-4.5`)
- **SDK**: Vercel AI SDK (`ai` package v5.0.81) with Anthropic provider (`@ai-sdk/anthropic` v2.0.38)
- **System Prompt**: Defined in `src/lib/prompt.ts` - guides AI to provide tech stack recommendations
- **Tools**: AI has access to custom tools (search, calculate) for enhanced functionality

**Key files**:

- `src/lib/config.ts` - Model configuration, system prompt, and tools
- `src/lib/prompt.ts` - System prompt for Stack Generator assistant
- `src/lib/tools.ts` - Dynamic tool loader
- `src/lib/tools/search.ts` - Web search using Exa API
- `src/lib/tools/calculate.ts` - Mathematical calculations
- `src/pages/api/message/generate.ts` - API endpoint handling conversation flow

**Environment Requirements**:

- `ANTHROPIC_API_KEY` - Anthropic API key for Claude access
- `EXA_SEARCH_API_KEY` - Exa API key for web search functionality
- Database credentials (see Database section below)

### API Architecture

**POST `/api/message/generate`**:

- Accepts: `{ text: string, id?: string, isPublic?: boolean }` (user message, optional thread ID, public flag)
- Returns: `{ generatedText: string, generatedTitle: boolean, id: string, ...extractedData }`
- Flow:
  1. Authenticates user via `locals.auth()` (requires authentication)
  2. Generates or retrieves thread ID using `nanoid`
  3. Enforces thread limit per user (max 5 threads, configurable in `config.ts`)
  4. Fetches conversation history from PostgreSQL (if thread exists)
  5. Verifies thread ownership (prevents unauthorized access)
  6. Builds conversation with system message + history + new user message
  7. Invokes Claude AI using `generateText()` with tools and max 25 steps
  8. Generates conversation title on first message using separate AI call
  9. Saves conversation to PostgreSQL (creates new or updates existing thread)
  10. Returns AI response with thread ID and title

**Key Features**:

- Extensive logging with request IDs for debugging
- Thread ownership verification
- Per-user thread limits
- Public/private thread support
- Development mode tracking (`isDev` flag)

### Database (PostgreSQL with Drizzle ORM)

**Database**: PostgreSQL (hosted on Vercel Postgres)

**ORM**: Drizzle ORM v0.44.7 with drizzle-kit v0.31.6

**Key files**:

- `src/db/schema.ts` - Database schema definitions
- `src/db/initialize.ts` - Database client initialization
- `drizzle.config.ts` - Drizzle configuration for migrations

**Database Schema**:

1. **threads** table:
   - `id` (text, primary key) - Thread identifier
   - `title` (text) - Conversation title
   - `thread` (jsonb) - Message history: `{ messages: [{ role, content }] }`
   - `cost` (numeric) - Cost tracking in dollars
   - `email` (text) - User email (for ownership)
   - `isPublic` (boolean) - Public accessibility flag
   - `isDev` (boolean) - Development/test flag
   - `createdAt` (timestamp) - Creation timestamp
   - `updatedAt` (timestamp) - Last update timestamp

2. **mega_list** table:
   - `name` (text, primary key)
   - `type` (text) - Technology type
   - `subtype` (text) - Technology subtype
   - Timestamps

3. **company_info** table:
   - `name` (text, primary key) - Product name
   - `provider` (text)
   - `subcategory` (text)
   - `description` (text)
   - `keyfeature` (text)
   - `documentation` (text)
   - Timestamps

**Environment Variables**:

- `POSTGRES_URL` - PostgreSQL connection string (pooled)
- `DATABASE_URL` - Alternative connection string
- `DATABASE_URL_UNPOOLED` - Direct connection (without pgbouncer)
- Individual parameters: `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`

### AI Tools System

The application has an extensible AI tools system located in `src/lib/tools/`:

**Tool Loading**:

- `src/lib/tools.ts` dynamically imports all tools from `tools/*.ts` (except files starting with `_`)
- Tools use Vercel AI SDK's `tool()` function with Zod schemas
- Tools are automatically registered and available to the AI

**Available Tools**:

1. **search** (`tools/search.ts`):
   - Web search using Exa API
   - Input: `query` (string)
   - Returns: Search results with content

2. **calculate** (`tools/calculate.ts`):
   - Mathematical calculations
   - Operations: add, subtract, multiply, divide, power, sqrt, modulo, abs, ceil, floor, round
   - Input: `operation`, `a`, optional `b`
   - Returns: Calculation result

3. **updateThreadCost** (`tools/updateThreadCost.ts`):
   - Updates thread cost tracking (implementation not shown)

**Adding New Tools**:

1. Create a new file in `src/lib/tools/*.ts`
2. Export a `tool()` using Vercel AI SDK format with Zod schema
3. File will be automatically loaded by `tools.ts`

### Styling Architecture

- SCSS with modular organization
- Variables: `src/styles/variables/globals.scss` and `colors.scss`
- Component-specific styles in matching file structure
- Typography: Montserrat (Google Fonts) for both layouts
- Icons: Font Awesome (via CDN) for app layout only

### Configuration Files

- **astro.config.mjs** - SSR mode with Vercel adapter (`output: 'server'`)
- **drizzle.config.ts** - Drizzle ORM configuration (PostgreSQL dialect, migrations in `src/db/migrations`)
- **tsconfig.json** - TypeScript strict mode (extends `astro/tsconfigs/strict`)
- **package.json** - Project name: "tech-stack-generator", version 0.0.1, uses ES modules
- **.gitignore** - Excludes `dist/`, `.astro/`, `.vercel/`, `node_modules/`, `.env*`

## Key Technologies

- Astro v5.15.1 (SSR framework with Vercel adapter)
- Anthropic Claude AI via Vercel AI SDK:
  - `ai` v5.0.81 (Vercel AI SDK)
  - `@ai-sdk/anthropic` v2.0.38
- PostgreSQL with Drizzle ORM:
  - `drizzle-orm` v0.44.7
  - `@vercel/postgres` v0.10.0
  - `drizzle-kit` v0.31.6 (dev)
- Exa Search API (`exa-js` v1.10.2) for web search
- SCSS/Sass v1.93.2 (styling)
- TypeScript with strict configuration
- nanoid v5.1.6 (unique ID generation)
- marked v16.4.1 (Markdown parsing)
- Deployment: Vercel

## Setup Instructions

1. **Install dependencies**: `npm install`
2. **Configure environment variables**: Create `.env` file with:
   - `ANTHROPIC_API_KEY` - Anthropic API key
   - `EXA_SEARCH_API_KEY` - Exa search API key
   - `POSTGRES_URL` - PostgreSQL connection string (or individual `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`)
   - See `.env.needed` for template
3. **Set up database**: Ensure PostgreSQL database is created and accessible
4. **Run migrations** (if needed): Use drizzle-kit to run migrations
5. **Start development server**: `npm run dev`
