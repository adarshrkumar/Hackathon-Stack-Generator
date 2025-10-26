# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **Stack Generator** web application built for the SCU AWS Hackathon Project. It's an Astro-based application using server-side rendering (SSR) with AWS Bedrock integration for AI-powered conversations. The app uses SCSS for styling with a modular architecture and is deployed on Vercel.

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
  - App pages: `app/index.astro`, `app/chat.astro`, `app/test.astro`
- **src/pages/api/** - API routes for backend functionality
  - `api/message/generate.ts` - Main AI chat endpoint (uses AWS Bedrock)
- **src/lib/** - Shared utilities and services
  - `bedrock.ts` - AWS Bedrock client and Llama model integration
  - `config.ts` - Application configuration (model, region, system prompts)
  - `types.ts` - TypeScript interfaces (Message, BedrockResponse)
- **src/layouts/** - Page layouts (dual layout system)
  - `Layout.astro` - Marketing site layout (Header + Hero + Footer)
  - `App.astro` - Application layout (Nav + Footer, no Hero)
- **src/components/** - Reusable Astro components
  - Global: `Header.astro`, `Footer.astro`, `Hero.astro`, `FancyCard.astro`
  - App-specific: `app/Nav.astro`, `app/Grid.astro`, `app/GridItem.astro`
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

2. **App Layout (`App.astro`)**:
   - Used for: `/app/*` pages (app interface)
   - Includes: Nav, Footer (no Hero)
   - Title format: "Stack Generator App" or "{title} | Stack Generator App"
   - Imports: `reset.scss`, `Layout.scss`, `App.scss`
   - Includes Font Awesome icons via CDN
   - Body has `class="app-layout"`, main has `class="main app"`

### AWS Bedrock Integration

The application integrates with AWS Bedrock for AI conversations:

- **Model**: Meta Llama 3.1 70B Instruct (`meta.llama3-1-70b-instruct-v1:0`)
- **Region**: us-east-1
- **Client**: `@aws-sdk/client-bedrock-runtime` (BedrockRuntimeClient)
- **Prompt Format**: Llama-specific chat format with special tokens (`<|begin_of_text|>`, `<|start_header_id|>`, etc.)

**Key files**:
- `src/lib/bedrock.ts` - Contains `invokeBedrockLlama()` and `generateConversationTitle()`
- `src/lib/config.ts` - Model configuration and system prompts
- `src/pages/api/message/generate.ts` - API endpoint handling conversation flow

**Environment Requirements**:
AWS credentials must be configured via environment variables or AWS credential chain for Bedrock access.

### API Architecture

**POST `/api/message/generate`**:
- Accepts: `{ text: string, id?: string }` (user message and optional thread ID)
- Returns: `{ generatedText: string, generatedTitle: string, id: string }`
- Flow:
  1. Generates or retrieves thread ID using `nanoid`
  2. Fetches conversation history (currently stubbed, TODO: database integration)
  3. Formats messages for Llama prompt
  4. Invokes AWS Bedrock with conversation history
  5. Generates conversation title on first message
  6. Saves conversation to database (currently stubbed)
  7. Returns AI response with thread ID and title

**Database Integration Status**: The API has TODO markers for database operations (thread creation, retrieval, updates). Currently uses in-memory conversation management.

### Styling Architecture

- SCSS with modular organization
- Variables: `src/styles/variables/globals.scss` and `colors.scss`
- Component-specific styles in matching file structure
- Import pattern: `@use './variables/globals.scss' as *;`
- Typography: Montserrat (Google Fonts) for both layouts
- Icons: Font Awesome (via CDN) for app layout only

### Configuration Files

- **astro.config.mjs** - SSR mode with Vercel adapter (`output: 'server'`)
- **tsconfig.json** - TypeScript strict mode (extends `astro/tsconfigs/strict`)
- **package.json** - Project name: "aws-project", version 0.0.1, uses ES modules
- **.gitignore** - Excludes `dist/`, `.astro/`, `.vercel/`, `node_modules/`, `.env*`

## Key Technologies

- Astro v5.15.1 (SSR framework with Vercel adapter)
- AWS Bedrock Runtime SDK v3.917.0 (AI model integration)
- SCSS/Sass v1.93.2 (styling)
- TypeScript with strict configuration
- nanoid v5.1.6 (unique ID generation)
- Deployment: Vercel
