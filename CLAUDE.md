# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **AWS Cost Explorer** web application built for the SCU AWS Hackathon Project. It's an Astro-based static site (v0.0.1) using SCSS for styling with a modular architecture.

## Development Commands

Run all commands from the project root:

- `npm install` - Install dependencies
- `npm run dev` - Start development server at `localhost:4321`
- `npm run build` - Build production site to `./dist/`
- `npm run preview` - Preview production build locally
- `npm run astro ...` - Run Astro CLI commands (e.g., `npm run astro add`, `npm run astro check`)

## Architecture

### Project Structure

- **src/pages/** - File-based routing (currently: `index.astro`, `about.astro`)
- **src/layouts/** - Page layouts (`Layout.astro` is the base layout)
- **src/components/** - Reusable Astro components (`Header.astro`, `Footer.astro`, `Hero.astro`)
- **src/styles/** - SCSS stylesheets organized by type:
  - `reset.scss`, `globals.scss` - Global styles
  - `variables/` - SCSS variables (`globals.scss`, `colors.scss`)
  - `components/` - Component-specific styles (`header.scss`, `footer.scss`, `hero.scss`)
- **public/** - Static assets served as-is
- **dist/** - Production build output (generated, not committed)

### Layout System

The `Layout.astro` file serves as the base template for all pages:
- Automatically renders `Header`, `Hero` (on homepage only), and `Footer` components
- Handles page title formatting: homepage shows "AWS Cost Explorer", other pages show "{title} | AWS Cost Explorer"
- Imports global styles (`reset.scss`, `globals.scss`) for all pages
- Uses Google Fonts (Montserrat) as the primary typeface

Pages should use the layout like this:
```astro
---
import Layout from '../layouts/Layout.astro';
---
<Layout title="Page Title">
  <!-- Page content here -->
</Layout>
```

### Styling Architecture

- Uses SCSS with modular organization
- Global SCSS variables defined in `src/styles/variables/` (e.g., `$main-padding: 2rem`)
- Component styles kept separate in `src/styles/components/`
- Import variables using `@use './variables/globals.scss' as *;`
- Primary font: Montserrat (loaded from Google Fonts)

### Configuration

- **astro.config.mjs** - Astro configuration (default settings)
- **tsconfig.json** - TypeScript strict mode (extends `astro/tsconfigs/strict`)
- **package.json** - Project name: "aws-project", uses ES modules

## Key Technologies

- Astro v5.15.1 (SSG framework)
- SCSS/Sass v1.93.2 for styling
- TypeScript with strict configuration
- File-based routing
