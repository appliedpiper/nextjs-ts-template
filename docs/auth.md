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
2. **At the resource** — `src/app/(app)/admin/layout.tsx` calls
   `requireRole("admin")` before rendering. The admin segment stays protected even
   if the proxy matcher is later changed or narrowed.

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

Two different jobs, and only the first needs the Clerk Dashboard.

### Bootstrapping the first admin — Dashboard, once per instance

Nothing in the codebase creates an admin, and there is no sign-up route, so the
very first one has to be made by hand. There is no way around this: granting the
first admin from inside the app would mean an unauthenticated path to admin.

1. In the Clerk Dashboard, go to **Users**.
2. If no users exist, click **Create user** and set an email and password.
   (Accounts can only be created here for now — the app has no `/sign-up` route.)
3. Click the user, open the **Metadata** tab, and edit **Public metadata**.
4. Set it to:

   ```json
   { "role": "admin" }
   ```

5. Save, then sign in to the app and visit `/admin/access`.

### Promoting everyone else — `/admin/access`

Once one admin exists, do the rest in the app. **Administration → Access** lists
every Clerk account with its current role and a dropdown to change it. Selecting
a role saves immediately; there is no Save button.

What the page will not let you do, and why:

| Behaviour | Reason |
| --- | --- |
| **Your own row is locked** | An admin who demotes themselves can leave the portal with no admin, with no way back except the Dashboard. To step down, have another admin do it. |
| **"no role" is shown but cannot be chosen** | It reports empty `public_metadata`, which is what every hand-created account starts with. It is a state, not a role — `ROLES` has no such member. |
| **Only `admin` and `user` are offered** | The server action re-validates against `ROLES` and rejects anything else, so a crafted request cannot invent a role. |

Accounts listed here are **Clerk accounts**. The list at
**Administration → Customers** is MongoDB records from the GraphQL API — a
separate set of people with no Clerk id and no role. Changing a role has nothing
to do with that page.

> **Security note.** `/admin/access` is protected in three places — the proxy,
> the `admin` segment layout, and the page itself — but none of those is what
> protects the *change*. `setRole` is a server action, which compiles to a public
> POST endpoint any signed-in user can call directly, so it re-checks
> `requireRole('admin')` itself on every invocation. If you add another
> role-mutating action, it must do the same; hiding the UI is not protection.

You can still edit `public_metadata` directly in the Dashboard at any time —
`{ "role": "user" }` for a regular account, or leave it empty, which behaves the
same as `user`.

### Role changes are not instant

Clerk session tokens are short-lived and refresh automatically, so a metadata
change reaches the app on the next refresh — up to about a minute — rather than
immediately. Signing out and back in applies it at once.

**A promoted user also has to reload before the sidebar changes.** The role is
resolved in the `(app)` layout, and Next renders a layout once per full page
load; client-side navigation reuses it. So a new admin can reach `/admin/access`
by URL — `requireRole` reads the fresh token server-side — while their sidebar
still shows no Administration section. That is not a bug, and
`revalidatePath` cannot fix it: it does not reach another user's browser. A hard
reload does.

---

## Adding protected routes

**A new page needs no auth code.** Everything is protected by default, so it
requires a signed-in user automatically.

To make a route public, add it to `PUBLIC_PATHS` in `src/lib/auth/access.ts`.
Prefixes match the whole subtree, so `/sign-in` also covers
`/sign-in/factor-one`.

To gate a route on a role, put it under `/admin/*` — that is the whole
convention, and the existing `src/app/(app)/admin/layout.tsx` guard covers it.

Gating a route does **not** add it to the sidebar, and adding it to the sidebar
does not gate it. Those are separate changes; see
[`layout.md`](./layout.md#4-role-visibility).

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
| `src/lib/auth/users.ts` | The only module that calls Clerk's Backend API — lists accounts, writes a role. Carries no authorization itself. |
| `src/lib/auth/setRole.ts` | The guarded server action. **The security boundary for a role change.** |
| `src/lib/auth/roleChange.ts` | The action's result shape and messages. Separate because a `'use server'` file may export only async functions. |
| `src/types/globals.d.ts` | Types the session token's `metadata.role`. |
| `src/app/(app)/admin/layout.tsx` | Applies `requireRole("admin")` to `/admin/*`. Guard only — chrome comes from the `(app)` group. |
| `src/app/(app)/admin/access/page.tsx` | Role management. Resolves identity and loads accounts, then hands off to the table. |
| `src/components/access/AccessTable.tsx` | The role table's interactive half. No fetching, no authorization. |
| `src/components/layout/DefaultLayout.tsx` | Reads the role to filter navigation. Display only, **not** enforcement. |
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
| A promoted user can open `/admin/access` but has no Administration sidebar | Expected. The `(app)` layout renders once per page load — they need a hard reload. See [above](#role-changes-are-not-instant) |
| Every account shows "no role" on `/admin/access` | Their `public_metadata` really is empty — distinct from the claim problem above, which hides the role from the *token* |
| The Role dropdown is greyed out on one row | That row is you. Your own role is locked by design |
| Sign-in shows Clerk's hosted page, not the styled one | `NEXT_PUBLIC_CLERK_SIGN_IN_URL` missing from `.env.local` |
| `The <SignIn/> component is not configured correctly` | `/sign-in` must stay an optional catch-all, `sign-in/[[...rest]]/page.tsx` — Clerk serves its own sub-routes beneath it |
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

Role assignment is covered separately, in `src/lib/auth/setRole.test.ts`:
authorization before argument validation, self-change refused, unrecognised and
non-string roles refused, Clerk's error text not leaked, and nothing revalidated
when a write fails.

**Two things tests here cannot catch**, both learned the hard way:
- **Route-file placement.** `/sign-in` must be an optional catch-all; a plain
  `page.tsx` compiles and passes every test, then fails in the browser.
- **`'use server'` export rules.** A file exporting anything but async functions
  fails the build — but only once something imports it. An unreferenced action
  compiles clean.

---

## Known gaps

- **The GraphQL backend has no token verification.** These gates protect pages
  and the internal `/api/graphql` route only. The backend remains directly
  reachable, so a signed-out client can still query it. Closing that is separate
  backend work.
- **No `/sign-up` route.** Clerk's widget shows a sign-up link that has nowhere
  to go; it bounces back to sign-in. Create accounts from the Dashboard.
- **No audit trail on role changes.** `/admin/access` writes the new role and
  nothing else — who changed it, and when, is not recorded anywhere.
- **Concurrent mutual demotion can leave zero admins.** Self-changes are
  refused, so *sequential* changes can never empty the admin set — it shrinks at
  most to whoever is making the change. But if two admins demote each other at
  the same moment, neither request is a self-change, both pass, and both
  succeed. Recovery is the Clerk Dashboard. A "would this leave zero admins?"
  check is itself racy without a lock, so this is accepted for now rather than
  half-solved.
- **New accounts start with no role.** Nothing stamps a default, because there
  is no `user.created` webhook and no sign-up route. Harmless today —
  `satisfiesRole(undefined, 'user')` is true, so a role-less account reaches
  every non-admin route — but it means `/admin/access` shows "no role" for every
  new account until someone sets one.
- **`/admin/access` does not paginate.** It fetches one page of 500 accounts
  (Clerk's maximum) and warns when the directory is larger. Clerk's own default
  is 10, which is why the limit is set explicitly.
