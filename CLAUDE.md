# CLAUDE.md — Frontend (Next.js + Clerk)

## Stack
- Next.js 16 (App Router, Turbopack) · React 19 · TypeScript
- Auth: Clerk (`@clerk/nextjs`)
- UI: MUI v7 + Emotion — check for an existing theme/provider before
  assuming Tailwind utility classes are the styling convention here; the
  Tailwind devDependencies are present but MUI is the primary component
  library
- Data fetching: TanStack Query, typed against
  `@appliedpiper/graphql-template-contract` (generated from the backend
  schema — don't hand-write response types that duplicate it)
- Validation: Zod v4
- Tests: **Vitest** (not Jest) with jsdom for component tests. The repo
  currently still has `jest.config.ts` and leftover Jest deps (`jest`,
  `jest-environment-jsdom`, `ts-jest`, `@types/jest`) from the template —
  these should be removed and replaced with Vitest before writing any
  tests:
  - `pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom`
  - remove `jest`, `jest-environment-jsdom`, `ts-jest`, `@types/jest`
  - delete `jest.config.ts`, add `vitest.config.ts`
  - add `"test": "vitest run"` and `"test:watch": "vitest"` scripts to
    `package.json`
  - No tests exist yet on this project — this is a from-scratch setup, not
    a migration of existing test files
- Package manager: pnpm (see `pnpm-workspace.yaml`)

## Conventions
- App Router only — no `pages/` directory
- Server Components by default; add `"use client"` only where Clerk hooks,
  interactive MUI components, or browser APIs actually require it
- `middleware.ts` controls which routes require auth — check it before
  assuming a route is public or protected
- Env vars: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` — never
  log, echo, or hardcode these
- If a component needs a GraphQL field that doesn't exist yet in the
  contract package, that's a backend schema change — flag it rather than
  mocking the shape locally and moving on

## Commands
```
pnpm dev      # turbopack dev server, :3000
pnpm build    # turbopack build
pnpm lint
```