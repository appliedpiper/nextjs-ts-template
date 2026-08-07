# Frontend

Next.js 16 App Router frontend with Clerk authentication, role-based route
protection, MUI components, and a typed GraphQL data layer.

Every route requires a signed-in user by default. Routes under `/admin/*`
additionally require the `admin` role. See [`docs/auth.md`](./docs/auth.md).

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

**Admin area.** `/admin/*` renders inside an MUI AppBar and collapsible Drawer
and requires the `admin` role. `/admin/users` lists users from the backend.

**Typed GraphQL data layer.** TanStack Query hooks call an internal
`/api/graphql` route handler, which forwards to the real GraphQL server. The
browser never talks to the backend directly.

## Routes

| Route | Access | What it shows |
| --- | --- | --- |
| `/sign-in` | Public | Custom-styled Clerk sign-in |
| `/` | Any signed-in user | User list, no app chrome |
| `/admin/users` | `admin` only | User list inside the admin layout |

There is no `/sign-up` route yet — create accounts from the Clerk Dashboard.

## Project layout

```
src/
├── app/                    # App Router routes
│   ├── layout.tsx          # Root layout — wraps everything in Providers
│   ├── page.tsx            # /
│   ├── sign-in/            # /sign-in
│   ├── admin/              # /admin/* — admin-only segment
│   └── api/graphql/        # Route handler forwarding to the GraphQL backend
├── components/             # React components
├── lib/
│   ├── auth/               # Authorization policy, role helpers, guards
│   ├── api/                # TanStack Query hooks, queries, cache keys
│   ├── graphql/            # GraphQL fetch client
│   ├── env/                # Zod-validated environment access
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
role guard, session-claim parsing, and the sign-in page. Both enforcement layers
are tested independently.

## Documentation

- [`docs/auth.md`](./docs/auth.md) — auth flow, roles, assigning roles, adding protected routes
- [`docs/auth-component-flow.md`](./docs/auth-component-flow.md) — diagrams of the request lifecycle and component tree

## Known gaps

This is a POC. Deliberately unfinished:

- **The GraphQL backend has no token verification.** Protecting these pages does
  nothing for it; it remains directly reachable and a signed-out client can
  still query it.
- **No `/sign-up` route.** Accounts are created from the Clerk Dashboard.
- **No CI, staging environment, or API rate limiting.**
