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
  - **Client Task Portal**: Share button in Tasks header opens portal sheet. Creates a workspace via API, generates a shareable link to the Client Portal web app where clients can submit tasks. Incoming tasks appear as "pending" and can be claimed into local task list.
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
  - **Subscription / RevenueCat** (Replit integration installed):
    - `lib/revenuecat.tsx` — `initializeRevenueCat()`, `SubscriptionProvider`, `useSubscription` hook, `PurchaseConfirmModal`
    - `app/paywall.tsx` — paywall screen (Free/Pro/Business plan cards, subscribe/restore)
    - `components/UpgradeModal.tsx` — shared gate modal that navigates to paywall
    - Tiers: **Free** (1 timer, 3 clients, basic invoicing), **Pro** $9.99/mo (unlimited, PDF export, expenses, all themes), **Business** $19.99/mo (adds Smart Insights, team sync, batch invoice, portal sync)
    - Entitlements: `pro` and `business`; Business implies Pro
    - Web mock: AsyncStorage key `rc_mock_tier` (`'free'`|`'pro'`|`'business'`) simulates purchases without network calls
    - Gates enforced in: `clients.tsx` (3-client limit), `work.tsx` (2nd timer, batch invoice), `reports.tsx` (PDF, Smart Insights), `settings.tsx` (themes, billing section)
    - Env vars: `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY`, `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`

- `app/team.tsx` — Team & Delegation screen (workspace create/join, member management, task delegation, time logs)
  - `services/teamSync.ts` — API client for team workspace operations

### API Server
- **Kind**: api (Express backend)
- **Port**: 8080
- **Description**: Shared backend for collaboration features (portal workspaces, tasks, team management, time tracking)
- **Endpoints**:
  - Workspaces: POST /api/workspaces, POST /api/workspaces/:code/join, GET /api/workspaces/:code
  - Client auth: POST /api/workspaces/:code/login, PUT /api/workspaces/:code/clients, PATCH change-password, PATCH keep-password
  - Team auth: PUT /api/workspaces/:code/team-members, POST /api/workspaces/:code/team-login
  - Tasks: GET/POST /api/workspaces/:code/tasks, GET team-tasks?email=X, GET pending, PATCH claim, PATCH status
  - Time tracking: POST /api/workspaces/:code/time-entries/start, PATCH stop, GET time-entries, GET running
  - Notes: POST/GET /api/workspaces/:code/tasks/:id/notes, GET /api/workspaces/:code/notes?since=X&email=Y (all notes, scoped by user visibility)
- **Types**: SharedTask (with assignedTo, source: client|freelancer|team), TeamMember, TimeEntry, TaskNote
- **Storage**: In-memory JSON file (store.ts)

### Client & Team Portal (web)
- **Slug**: client-portal
- **Kind**: React + Vite web app
- **Preview path**: /client-portal
- **Description**: Unified web portal for clients AND team members. Accessed via shareable link (?code=XXXXXX, optional &mode=team for team login).
  - **Client mode**: Submit tasks, view task status with due date tracking, comment notifications
  - **Team mode**: View assigned tasks, start/stop timers, update task status, add notes, see time logs, comment notifications
  - Login form has a "Switch to team/client" toggle at the bottom
  - **Notification bell**: Both portals poll for new comments (12s interval), show badge count, dropdown with recent comments, "Mark all read" dismiss
- **Key components**: TaskBoard.tsx (client), TeamTaskBoard.tsx (team), LoginForm.tsx (dual-mode), ChangePasswordModal.tsx

### Comments System
- **Local storage**: `TaskComment` type in AppContext with `taskComments` array persisted to AsyncStorage
- **Mobile app**: Comments available on ALL tasks (Tasks tab) and ALL time entries (Work tab)
  - Tasks tab: comment section inside task edit BottomSheet, works for both portal-synced and local-only tasks
  - Work tab: "Leave a note" field in Timer Stopped modal, notes & comments section in Entry Detail sheet
- **Sync**: Background interval (20s) pushes unsynced local comments to portal API when task has `portalTaskId`; `markCommentsSynced(ids)` prevents duplicates
- **Portals**: Notification bell with badge polls `/workspaces/:code/notes?email=X&since=Y`, scoped to user-visible tasks only
