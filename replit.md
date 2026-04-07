# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### WorkPilot Pro (mobile)
- **Slug**: workpilot-pro
- **Kind**: expo (React Native / Expo)
- **Preview path**: /
- **Description**: A full-featured time tracking + business management mobile app
- **Features**:
  - Time tracking with live timer (start/stop)
  - Client management with per-client revenue tracking
  - Quotes creation and management
  - Invoices with full lifecycle (draft → sent → paid)
  - Quote-to-invoice conversion
  - Financial dashboard with KPI cards
  - Reports with period filtering (week/month/quarter/year)
  - Settings with currency and billing defaults
  - Guided tour (10-step tooltip walkthrough for first-time users, auto-triggers after onboarding)
  - About HourLink screen (app info, features, version, contact)
  - Privacy Policy screen (comprehensive, all-local-data focused)
- **Storage**: AsyncStorage (all data persisted locally)
- **Icons**: All icons use `AppIcon` component (`components/AppIcon.tsx`) wrapping `lucide-react-native` SVG icons. Never use Ionicons/vector-icons.
- **Key files**:
  - `context/AppContext.tsx` — global state, all data operations
  - `context/WelcomeContext.tsx` — onboarding overlay + guided tour state
  - `components/GuidedTour.tsx` — 10-step tooltip walkthrough
  - `components/AppIcon.tsx` — SVG icon mapping (Ionicons names → Lucide components)
  - `app/(tabs)/` — 6 main tabs: Home, Work, Tasks, Clients, Finance, Reports
  - `app/client/[id].tsx` — client detail with invoices/quotes
  - `app/invoice/[id].tsx` — invoice detail with status workflow
  - `app/quote/[id].tsx` — quote detail with status workflow
  - `app/settings.tsx` — user settings with Help & Info section
  - `app/about.tsx` — About HourLink screen
  - `app/privacy.tsx` — Privacy Policy screen
  - `constants/colors.ts` — design tokens (blue/slate theme)
