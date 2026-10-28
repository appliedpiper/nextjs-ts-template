# Frontend

Next.js 16 App Router frontend with Clerk authentication, role-based route
protection, a shared application layout, MUI components, and a typed GraphQL data
layer.

Every route requires a signed-in user by default. Routes under `/admin/*`
additionally require the `admin` role. See [`docs/auth.md`](./docs/auth.md).

Every signed-in page renders inside a shared shell — collapsible sidebar, header,
content column — whose navigation and header items vary by role. See
[`docs/layout.md`](./docs/layout.md).

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) · React 19 · TypeScript |
| Auth | Clerk (`@clerk/nextjs` v6) |
| UI | MUI v7 + Emotion |
| Data | TanStack Query → GraphQL over HTTP |
| Validation | Zod v4 |
| Tests | Vitest + Testing Library (jsdom) |
| Package manager | pnpm |

## Setup

Requires **Node 20+** and **pnpm**.

```bash
pnpm install
```

Create `.env.local` in this directory:

```bash
# Where the GraphQL backend lives (server-side only, never exposed to the browser)
GRAPHQL_SERVER=http://localhost:4000/graphql

# Clerk credentials — from the Clerk Dashboard under API Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Sends Clerk's redirects to the custom in-app sign-in page rather than
# Clerk's hosted Account Portal. Required for the styled sign-in page to appear.
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
```

`.env.local` is gitignored — never commit real keys.

**One manual step in the Clerk Dashboard is required** before role checks work
at all. Without it, `/admin/*` denies everyone including real admins. See
[`docs/auth.md`](./docs/auth.md#required-clerk-dashboard-setup).

Then start the dev server:

```bash
pnpm dev
```

The app runs at <http://localhost:3000>. Visiting any page while signed out
redirects to `/sign-in`.

The user list needs the GraphQL backend running at whatever `GRAPHQL_SERVER`
points to — see the backend package. The frontend consumes backend types from
the published `@appliedpiper/graphql-template-contract` package rather than
reading backend source, so a backend schema change needs that package rebuilt
before the new shape is visible here.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server on :3000 (Turbopack) |
| `pnpm build` | Production build |
| `pnpm start` | Serve a production build |
| `pnpm lint` | ESLint |
| `pnpm test` | Run the test suite once |
| `pnpm test:watch` | Run tests in watch mode |

## Features

**Authentication and authorization.** Protected by default at the network edge,
with a second check at the resource for admin routes. Two roles, `admin` and
`user`, stored in Clerk public metadata. Fully documented in
[`docs/auth.md`](./docs/auth.md), including how to assign a role.

**Custom sign-in page.** `/sign-in` renders Clerk's widget centred in the
viewport, restyled from the MUI theme in `src/lib/theme.ts`. Editing that theme
restyles the sign-in page too — the appearance variables are derived from it
rather than hardcoded.

**Default application layout.** Every page under `src/app/(app)/` renders inside a
shared shell: a sidebar that collapses to an icon rail (or an overlay on mobile), a
header with a breadcrumb and the Clerk user menu, and a content column. Navigation
is a data registry in `src/lib/navigation/navigation.ts`, filtered by role on the
server so a non-admin's browser never receives admin entries. `[` toggles the
sidebar, and the collapsed state persists in a cookie so it survives a reload
without flashing. Documented in [`docs/layout.md`](./docs/layout.md), including how
to add an entry and why hiding a link is **not** the same as protecting a route.

**Admin area.** `/admin/*` requires the `admin` role, enforced at the edge and
again in the segment's own layout. `/admin/customers` lists customer records from
the GraphQL backend.

**Role management.** `/admin/access` lists every Clerk account with its current
role and a dropdown to change it, so promoting a colleague no longer means opening
the Clerk Dashboard. Your own row is locked, so an admin cannot demote themselves
and leave the portal with no admin. The change is written by a server action that
re-checks `requireRole('admin')` itself — hiding the page is not what protects it.
Bootstrapping the *first* admin still has to be done in the Dashboard; see
[`docs/auth.md`](./docs/auth.md#assigning-a-role-to-a-user).

> `/admin/access` manages **Clerk accounts**. `/admin/customers` lists **MongoDB
> records** from the GraphQL API — a separate set of people, with no Clerk id and
> no role. The two are unrelated.

**Typed GraphQL data layer.** TanStack Query hooks call an internal
`/api/graphql` route handler, which forwards to the real GraphQL server. The
browser never talks to the backend directly.

## Routes

| Route | Access | What it shows |
| --- | --- | --- |
| `/sign-in` | Public | Custom-styled Clerk sign-in — deliberately **no** app chrome |
| `/` | Any signed-in user | Customer list, inside the app layout |
| `/admin/customers` | `admin` only | Customer records from MongoDB, inside the app layout |
| `/admin/access` | `admin` only | Clerk accounts and their roles, with a dropdown to change them |

Routes that should render inside the app layout live under `src/app/(app)/`. The
parentheses make it a route group, which adds **no URL segment** —
`(app)/admin/customers` serves `/admin/customers`. `/sign-in` sits outside the
group.

Every route inside the group is server-rendered on demand, because the layout reads
the session and a cookie. `/sign-in` is dynamic too — it must be an optional
catch-all (`sign-in/[[...rest]]/page.tsx`) because Clerk's `<SignIn />` serves its
own sub-routes beneath it, and catch-alls are not prerendered.

There is no `/sign-up` route yet — create accounts from the Clerk Dashboard.

## Project layout

```
src/
├── app/                    # App Router routes
│   ├── layout.tsx          # Root layout — Providers only, no chrome
│   ├── (app)/              # Route group: everything here gets the app layout
│   │   ├── layout.tsx      #   renders DefaultLayout
│   │   ├── page.tsx        #   /
│   │   └── admin/          #   /admin/* — admin-only segment (guard only)
│   ├── sign-in/            # /sign-in — outside the group, so no chrome
│   │   └── [[...rest]]/    #   optional catch-all; required by Clerk's <SignIn />
│   └── api/graphql/        # Route handler forwarding to the GraphQL backend
├── components/
│   ├── access/             # AccessTable — the role-management table
│   ├── auth/               # SignInPanel
│   ├── layout/             # DefaultLayout, AppShell, AppHeader, AppSidebar
│   └── Users/              # Feature components
├── lib/
│   ├── auth/               # Authorization policy, role helpers, guards
│   ├── navigation/         # Nav registry + pure role filtering
│   ├── layout/             # Sidebar collapse preference (cookie)
│   ├── api/                # TanStack Query hooks, queries, cache keys
│   ├── graphql/            # GraphQL fetch client
│   ├── env/                # Zod-validated environment access
│   ├── clerkAppearance.ts  # Maps the MUI theme onto Clerk's appearance
│   ├── appConfig.ts        # APP_NAME
│   └── theme.ts            # MUI theme — single source of truth
├── types/                  # Ambient type declarations
└── proxy.ts                # Auth gate (Next.js 16's renamed middleware)
```

Note `src/proxy.ts` — Next.js 16 renamed `middleware.ts` to `proxy.ts`. It is
the file that decides which routes require auth.

## Testing

Vitest with jsdom. Tests sit beside the code they cover.

```bash
pnpm test
```

The suite covers the authorization policy, the proxy adapter, the server-side
role guard, session-claim parsing, the sign-in page, and the whole application
layout — the nav registry and its role filtering, each piece of chrome in
isolation, and the composed tree. Both enforcement layers are tested
independently.

Note that **jsdom does not evaluate `@media` queries**, so the layout's responsive
breakpoints are deliberately not asserted by the suite — they need a real browser.
See [`docs/layout.md`](./docs/layout.md#7-testing-notes).

## Documentation

- [`docs/auth.md`](./docs/auth.md) — auth flow, roles, bootstrapping the first admin, assigning roles at `/admin/access`, adding protected routes
- [`docs/layout.md`](./docs/layout.md) — the app layout, adding nav entries, role visibility, sidebar behaviour
- [`docs/auth-component-flow.md`](./docs/auth-component-flow.md) — diagrams of the request lifecycle and component tree

## Known gaps

This is a POC. Deliberately unfinished:

- **The GraphQL backend has no token verification.** Protecting these pages does
  nothing for it; it remains directly reachable and a signed-out client can
  still query it.
- **No `/sign-up` route.** Accounts are created from the Clerk Dashboard, and
  nothing assigns a role at creation — a new account is role-less until someone
  sets it, now most easily at `/admin/access`. Role-less accounts can still reach
  every non-admin route, so this is cosmetic rather than a lockout.
- **No audit trail on role changes.** `/admin/access` writes the new role and
  records nothing about who changed it, or when.
- **Concurrent mutual demotion can leave zero admins.** Self-changes are refused,
  so *sequential* changes can never empty the admin set. But two admins demoting
  each other simultaneously are each making a non-self change, so both succeed.
  Recovery is the Clerk Dashboard. Accepted rather than half-solved — a
  "would this leave zero admins?" check is itself racy without a lock.
- **`/admin/access` does not paginate.** One page of up to 500 accounts (Clerk's
  maximum), with a warning when the directory is larger.
- **The layout has not been checked at every viewport.** `/admin/access` has been
  exercised in a browser with two real accounts; the layout's responsive
  behaviour is still only covered by tests.
- **`/` duplicates `/admin/customers`.** Both render the same list inside the same
  chrome; `/` wants a real landing page.
- **No CI, staging environment, or API rate limiting.**
