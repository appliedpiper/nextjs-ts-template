# Authentication and authorization

Clerk handles authentication. Authorization is role-based, with two roles stored
in each user's Clerk **public metadata**.

For diagrams of the request lifecycle and the component tree, see
[`auth-component-flow.md`](./auth-component-flow.md). This document covers how it
behaves and how to operate it.

---

## How it works

**Everything is protected by default.** There is no list of protected routes to
maintain — instead, `/sign-in` is the only public path, and every other route
requires a session. Adding a page protects it automatically.

Enforcement happens in two places:

1. **At the edge** — `src/proxy.ts` runs before rendering and redirects
   unauthorized requests. This is what makes an unauthenticated visitor land on
   `/sign-in` without having to navigate there.
2. **At the resource** — `src/app/admin/layout.tsx` calls `requireRole("admin")`
   before rendering. The admin segment stays protected even if the proxy matcher
   is later changed or narrowed.

Both read the same policy from `src/lib/auth/access.ts`, so there is one place to
change a rule.

Next.js 16 renamed middleware to *proxy*; `src/proxy.ts` is the file other
projects would call `middleware.ts`.

### Why the role is trustworthy

The role travels in the Clerk **session token**, which is signed by Clerk and
verified server-side. A user cannot grant themselves `admin` by editing browser
state. Public metadata is readable by the client, though, so treat it as public —
never store anything sensitive there.

---

## The two roles

| Role | Grants |
| --- | --- |
| `user` | Access to every protected route except `/admin/*` |
| `admin` | Everything, including `/admin/*` |

The convention: **any route under `/admin/*` requires `admin`; every other
protected route only requires a signed-in session.**

A signed-in user with **no role set at all** is treated as a regular user — they
can use the app but not the admin area. That is deliberate, so the app still
works before roles have been assigned. Anything unexpected in the role claim (a
typo like `Admin`, an unknown value like `superadmin`, a non-string) is treated
as no role rather than being trusted.

Matching is segment-aware, so a future `/administrators` route would **not** be
treated as an admin route.

---

## Required Clerk Dashboard setup

**This step is mandatory and cannot be done from code.** The role lives in public
metadata, but the proxy reads it from the session token — and Clerk only puts it
there if you tell it to.

1. Open the [Clerk Dashboard](https://dashboard.clerk.com) and select the app.
2. Go to the **Sessions** page.
3. Find the session token **claims editor** (labelled *Customize session token*)
   and add:

   ```json
   { "metadata": "{{user.public_metadata}}" }
   ```

4. Save.

**Until you do this, `/admin/*` denies everyone — including accounts that
genuinely have the admin role.** That failure is intentional: the code fails
closed when it cannot determine a role. If admins are being bounced to `/`, check
this first.

---

## Assigning a role to a user

There is **no admin account yet.** Nothing in the codebase creates one, and no
sign-up route exists, so the first admin has to be made by hand:

1. In the Clerk Dashboard, go to **Users**.
2. If no users exist, click **Create user** and set an email and password.
   (Accounts can only be created here for now — the app has no `/sign-up` route.)
3. Click the user, open the **Metadata** tab, and edit **Public metadata**.
4. Set it to:

   ```json
   { "role": "admin" }
   ```

5. Save, then sign in to the app and visit `/admin/users`.

Use `{ "role": "user" }` for a regular account, or leave metadata empty — an
empty role behaves the same as `user`.

### Role changes are not instant

Clerk session tokens are short-lived and refresh automatically, so a metadata
change reaches the app on the next refresh rather than immediately. To apply it
right away, sign out and back in. If you change your own role and the app still
behaves as before, this is why.

---

## Adding protected routes

**A new page needs no auth code.** Everything is protected by default, so it
requires a signed-in user automatically.

To make a route public, add it to `PUBLIC_PATHS` in `src/lib/auth/access.ts`.
Prefixes match the whole subtree, so `/sign-in` also covers
`/sign-in/factor-one`.

To gate a route on a role, put it under `/admin/*` — that is the whole
convention, and the existing `src/app/admin/layout.tsx` guard covers it.

For a role check somewhere else, use the helpers rather than reading claims by
hand.

In a server component, page, or layout:

```ts
import { requireRole } from "@/lib/auth/requireRole";

export default async function Page() {
  await requireRole("admin"); // redirects if not satisfied
  return <AdminThing />;
}
```

To branch on a role without redirecting:

```ts
import { getCurrentRole } from "@/lib/auth/requireRole";

const role = await getCurrentRole(); // "admin" | "user" | undefined
```

Working from session claims you already have:

```ts
import { getRole, isAdmin, hasRole } from "@/lib/auth/roles";

const { sessionClaims } = await auth();
if (isAdmin(sessionClaims)) { /* ... */ }
```

To introduce a **third role**, add it to `ROLES` in `src/lib/auth/roles.ts` and
extend `satisfiesRole` to say what it grants. `Role` is derived from `ROLES`, so
TypeScript will point at everything that needs updating.

---

## Where each piece lives

| File | Responsibility |
| --- | --- |
| `src/proxy.ts` | Edge gate. Adapter only — holds no rules. |
| `src/lib/auth/access.ts` | The policy: public paths, admin paths, the decision. |
| `src/lib/auth/roles.ts` | Role vocabulary and safe session-claim parsing. |
| `src/lib/auth/requireRole.ts` | Server-side guards for pages and layouts. |
| `src/types/globals.d.ts` | Types the session token's `metadata.role`. |
| `src/app/admin/layout.tsx` | Applies `requireRole("admin")` to `/admin/*`. |
| `src/components/auth/SignInPanel.tsx` | The custom-styled sign-in page. |

---

## Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk client key |
| `CLERK_SECRET_KEY` | Clerk server key — never expose |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Must be `/sign-in`, or Clerk redirects to its hosted Account Portal instead of the custom page |

---

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| A real admin is redirected away from `/admin/*` | The session token claim isn't configured — see [above](#required-clerk-dashboard-setup) |
| A role change had no effect | Token hasn't refreshed yet; sign out and back in |
| Sign-in shows Clerk's hosted page, not the styled one | `NEXT_PUBLIC_CLERK_SIGN_IN_URL` missing from `.env.local` |
| Signed out and stuck in a redirect loop | `/sign-in` was removed from `PUBLIC_PATHS` |
| Every route redirects to sign-in when signed in | Clerk keys missing or from the wrong Clerk instance |

---

## Tests

```bash
pnpm test
```

The suite covers the policy exhaustively — unauthenticated redirects, the
`user`-on-`/admin/*` block, the `admin`-on-`/admin/*` pass, and the fail-closed
cases where the role claim is absent or malformed. Both the proxy and the
resource guard are tested independently, so neither layer can silently stop
enforcing.

---

## Known gaps

- **The GraphQL backend has no token verification.** These gates protect pages
  and the internal `/api/graphql` route only. The backend remains directly
  reachable, so a signed-out client can still query it. Closing that is separate
  backend work.
- **No `/sign-up` route.** Clerk's widget shows a sign-up link that has nowhere
  to go; it bounces back to sign-in. Create accounts from the Dashboard.
- **No audit trail on role changes.** Roles are edited by hand in the Clerk
  Dashboard, and nothing in the app records who changed what.
