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

## The GraphQL API

`src/app/api/graphql/route.ts` is the browser's only route to the GraphQL
backend, and it is an **enforcement point**, not a transparent proxy. It does two
things:

1. **Refuses an unauthenticated request with a real 401** and a GraphQL-shaped
   error body. `proxy.ts` also covers this path, but it answers with a 307 to
   `/sign-in` — correct for a navigation, useless for a `fetch`, which would
   fail trying to parse HTML as JSON. This is the same resource-versus-edge
   argument as `requireRole` for pages: the proxy is a perimeter check, this is
   the check at the resource.
2. **Attaches the caller's Clerk session token** as `Authorization: Bearer`.
   This is where a browser session becomes an API credential. The backend
   verifies that token and derives the identity and role from it, so **without
   this header every backend resolver refuses the request.**

The backend enforces its own policy independently — reads need any verified
session, writes need `admin` — so this route being correct is necessary but not
what makes the API safe. Port 4000 is directly reachable and the backend
verifies every request itself. Full details in `backend/docs/auth.md`.

### The GraphQL IDE at `/admin/graphql`

The easiest way to run queries by hand: an admin-only page embedding Apollo's
Sandbox, pointed at this app's own `/api/graphql`. **No token is involved.** The
browser already holds the Clerk session cookie, the API route converts it into a
Bearer token server-side, and the backend verifies that as usual.

| | |
| --- | --- |
| Page | `src/app/(app)/admin/graphql/page.tsx` |
| IDE | `src/components/graphql/GraphqlSandbox.tsx` |
| Endpoint it queries | `/api/graphql` — **same origin**, which is the whole mechanism |
| Who can reach it | admins only |
| In production | disabled, with an explanation |

**Why `/admin/graphql` rather than a GET handler on the API route:** everything
under `/admin` is already admin-gated, by `isAdminPath` in `lib/auth/access.ts`
(enforced in `proxy.ts`) and by `requireRole('admin')` in the admin layout. The
page reuses those gates rather than introducing a new one, and the API route is
untouched.

> **The admin gate is load-bearing, not cosmetic.** Reads are not scoped per
> customer, so an IDE available to every signed-in account would be a tool for
> browsing every *other* customer's records. Three things enforce it: the proxy,
> the admin layout, and a `requireRole('admin')` in the page itself.

Two implementation details worth knowing before changing that component:

- **`handleRequest` is supplied explicitly, and it is what makes auth work.**
  The embed's *default* request handler sets `credentials: 'omit'`, which would
  strip the Clerk cookie and make every query come back `UNAUTHENTICATED`. The
  component passes its own handler forcing `credentials: 'same-origin'`. There
  is a test asserting this; don't remove it in favour of the embed's
  `includeCookies` flag.
- **The IDE is loaded from Apollo's CDN**, not bundled, so this adds no
  dependency — but the page needs network access to
  `embeddable-sandbox.cdn.apollographql.com`. If the CDN is unreachable the page
  says so and points at `pnpm dev:token` instead of rendering blank. The script
  URL is pinned to the `/v2/` path rather than `_latest`, so an upstream release
  cannot change the IDE without a commit here.

**It is disabled in production** because Apollo turns off schema introspection
when `NODE_ENV=production`, which would leave the IDE with no schema, no docs
and no autocomplete. The page explains that rather than rendering a broken
embed.

### Calling `/api/graphql` by hand

Three things trip people up, all verified against the running stack rather than
assumed:

**It only accepts `POST`.** `POST` is the only exported method, so opening
`http://localhost:3000/api/graphql` in a browser address bar is a `GET` and
returns **405 Method Not Allowed**. That is not a permissions problem, and no
amount of being an admin changes it. There is also no GraphQL IDE here — this
route is a bare JSON relay, not Apollo Sandbox.

**It requires a signed-in account, not an admin.** `/api/graphql` is not under
`/admin`, so `requiredRoleFor` returns `'user'`, and `satisfiesRole(role,
'user')` is true for *any* signed-in account — including one with no role at
all. Admin only becomes decisive at the backend, for the write mutations.

**Use a Bearer token, not the cookie.** Clerk authenticates this route from
either the `Authorization` header or the session cookie, but on a
**development** Clerk instance the cookie path also needs Clerk's dev-browser
token, so copying `__session` into curl fails with `dev-browser-missing`. The
header works:

```bash
TOKEN=$(docker compose exec -T backend pnpm -s dev:token --raw)

curl -s -X POST http://localhost:3000/api/graphql \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"{ users { _id firstName } }"}'
```

> The same **no-colon** rule applies here as at the backend: `Bearer: <token>`
> authenticates as nobody. Verified — it comes back `isSignedIn: false`.

Two consequences worth knowing:

- **A role change reaches the API on the next token refresh** (~60s), the same
  delay as the UI, because the token is minted per request from the session.
- **Both packages must use the same Clerk instance.** The frontend mints the
  token and the backend verifies it; mismatched instances produce
  `UNAUTHENTICATED` on every request with a token that looks perfectly valid.

---

## Where each piece lives

| File | Responsibility |
| --- | --- |
| `src/proxy.ts` | Edge gate. Adapter only — holds no rules. |
| `src/app/api/graphql/route.ts` | Refuses unauthenticated API calls (401) and attaches the session token for the backend. **Enforcement, not a proxy.** |
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
| Pages load but data is empty, with `UNAUTHENTICATED` from the API | The backend rejected the token. Usually the two packages are on **different Clerk instances** — check `CLERK_SECRET_KEY` matches `backend/.env.local` |
| Data calls fail with `FORBIDDEN` | The query needs `admin` on the **backend** policy, which is separate from this app's route gating. See `backend/docs/auth.md` |
| The backend exits at startup with an env error | It needs `CLERK_SECRET_KEY` too, and refuses to boot without it |
| `BACKEND_UNREACHABLE` (502) from `/api/graphql` | The GraphQL server is down, crash-looping, or its hostname doesn't resolve. In Docker, a newly added backend dependency needs `docker compose restart backend` — see `backend/CLAUDE.md` |
| `BACKEND_BAD_RESPONSE` (502) | The backend answered with HTML or an empty body rather than JSON — usually a proxy error page in front of a dead server |
| `405` from `/api/graphql` | You sent a `GET` — most likely by opening the URL in a browser. The route only exports `POST`. Not a permissions issue |
| `dev-browser-missing` when curling `/api/graphql` with a cookie | On a development Clerk instance the cookie path needs Clerk's dev-browser token too. Use `Authorization: Bearer <token>` instead |

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

- ~~**The GraphQL backend has no token verification.**~~ **Closed.** The backend
  now verifies the Clerk session token on every resolver and refuses anything
  unverified, so reaching port 4000 directly no longer bypasses auth. See
  [The GraphQL API](#the-graphql-api) below and `backend/docs/auth.md`.
- **The GraphQL API is authenticated but not isolated.** Any signed-in account
  can read **every** customer's users and orders — those collections carry no
  ownership field, so there is nothing to scope by. This is now the largest
  remaining gap, and it is a data-model change rather than an auth change.
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
