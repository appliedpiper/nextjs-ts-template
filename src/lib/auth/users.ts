// Server-side access to Clerk accounts and the role held in their public
// metadata.
//
// This is the **only** module that calls Clerk's Backend API. The
// `/admin/access` page and the `setRole` action both go through it, so the SDK
// surface and the `publicMetadata` shape are pinned in one place rather than
// spread across a page and an action.
//
// These are *Clerk accounts*, which carry roles. They are unrelated to the
// MongoDB `User` documents behind `/admin/customers`, which carry none and have
// no Clerk ID — see `docs/auth-component-flow.md`.
//
// No `import 'server-only'` guard here: it isn't a direct dependency, and
// `@clerk/nextjs/server` already pulls one in, so importing this from a client
// component fails regardless.

import { clerkClient } from '@clerk/nextjs/server';

import { isRole, type Role } from './roles';

/**
 * Clerk's `getUserList` defaults to a page size of **10**, which would silently
 * hide most of the directory. 500 is the API maximum, so one request covers any
 * plausible size for this portal; `listUsers` reports when it didn't.
 */
export const USER_PAGE_LIMIT = 500;

/** A Clerk account, flattened to just what the role UI needs. */
export interface ManagedUser {
  id: string;
  /** Primary email if Clerk marks one, else the first on file, else ''. */
  email: string;
  /** Full name when set, otherwise the email, so a row is never blank. */
  name: string;
  /** `undefined` for unset *or* unrecognised values — see `roleFromMetadata`. */
  role: Role | undefined;
}

export interface ManagedUserList {
  users: ManagedUser[];
  /** Clerk's total, which may exceed `users.length`. */
  totalCount: number;
  /** True when `totalCount` outran one page, so the UI can say the list is partial. */
  truncated: boolean;
}

// The shape we rely on, rather than Clerk's full `User`. Keeping it structural
// means the mappers below unit-test against plain objects, with no need to
// construct a real Clerk resource.
interface ClerkUserLike {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  primaryEmailAddressId?: string | null;
  emailAddresses?: readonly { id: string; emailAddress: string }[];
  publicMetadata?: Record<string, unknown> | null;
}

/**
 * The role stored on a Clerk account.
 *
 * Distinct from `getRole` in `roles.ts` on purpose: that one reads a *session
 * claim*, where the metadata sits nested under a `metadata` key. Here we read
 * `publicMetadata` straight off the account, so there is no extra level. Both
 * fail closed on an unrecognised value.
 */
export function roleFromMetadata(metadata: Record<string, unknown> | null | undefined): Role | undefined {
  const raw = metadata?.role;
  return isRole(raw) ? raw : undefined;
}

/** Primary email when Clerk designates one, else the first, else ''. */
export function primaryEmailOf(user: ClerkUserLike): string {
  const addresses = user.emailAddresses ?? [];
  const primary = addresses.find((address) => address.id === user.primaryEmailAddressId);
  return primary?.emailAddress ?? addresses[0]?.emailAddress ?? '';
}

/** Flattens a Clerk account into the row shape the table renders. */
export function toManagedUser(user: ClerkUserLike): ManagedUser {
  const email = primaryEmailOf(user);
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();

  return {
    id: user.id,
    email,
    // An account created without a name still needs something in the cell, and
    // the email identifies the person better than a placeholder would.
    name: name || email,
    role: roleFromMetadata(user.publicMetadata),
  };
}

/**
 * Every Clerk account, newest first, as table rows.
 *
 * Capped at one page — see `USER_PAGE_LIMIT`. `truncated` tells the caller the
 * list is incomplete so it can say so rather than quietly showing a subset.
 */
export async function listUsers(): Promise<ManagedUserList> {
  const client = await clerkClient();
  const { data, totalCount } = await client.users.getUserList({
    limit: USER_PAGE_LIMIT,
    orderBy: '-created_at',
  });

  const users = data.map(toManagedUser);

  return {
    users,
    totalCount,
    truncated: totalCount > users.length,
  };
}

/**
 * Writes `role` to the account's public metadata.
 *
 * **Carries no authorization of its own** — callers must establish that the
 * requester may do this. `setRole` in `setRole.ts` is the guarded entry point;
 * don't call this straight from a page or a route handler.
 *
 * Clerk patches metadata rather than replacing the account, and `role` is the
 * only key this app writes, so unrelated keys are left as they are.
 */
export async function setUserRole(userId: string, role: Role): Promise<void> {
  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, {
    publicMetadata: { role },
  });
}
