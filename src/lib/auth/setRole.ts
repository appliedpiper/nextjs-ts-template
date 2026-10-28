'use server';

// The guarded entry point for changing a Clerk account's role.
//
// **This action is the security boundary, not the page that renders it.** A
// server action compiles to a public POST endpoint, so anyone holding any
// session can invoke it directly with arguments of their choosing. The
// `requireRole('admin')` call below is therefore load-bearing: it is not a
// duplicate of the check in `/admin/access/page.tsx`, and removing it would
// let any signed-in user promote themselves even though the page stays hidden.
//
// The declared parameter types are a compile-time convenience for callers in
// this repo. They are *not* a runtime guarantee — nothing stops a crafted
// request sending a number, an object, or an unknown role string — so every
// field is re-validated here regardless of its type.
//
// Only `setRole` is exported: Next.js permits nothing but async functions out
// of a `'use server'` file. The result type and messages live in
// `roleChange.ts` for that reason.

import { revalidatePath } from 'next/cache';

import { requireRole } from './requireRole';
import {
  ACCESS_PATH,
  INVALID_ROLE_ERROR,
  MISSING_USER_ERROR,
  SELF_CHANGE_ERROR,
  WRITE_FAILED_ERROR,
  type SetRoleResult,
} from './roleChange';
import { isRole, type Role } from './roles';
import { setUserRole } from './users';

export async function setRole(input: { userId: string; role: Role }): Promise<SetRoleResult> {
  // Deliberately outside the try/catch below. `requireRole` signals failure by
  // calling `redirect()`, which throws NEXT_REDIRECT for Next to handle —
  // catching that would convert a redirect into a result object and let the
  // request continue. It also runs *first*, so an unauthorized caller learns
  // nothing about whether their arguments were otherwise valid.
  const { userId: actorId } = await requireRole('admin');

  const { userId: targetId, role } = input ?? {};

  if (typeof targetId !== 'string' || targetId.length === 0) {
    return { ok: false, error: MISSING_USER_ERROR };
  }

  if (!isRole(role)) {
    return { ok: false, error: INVALID_ROLE_ERROR };
  }

  if (targetId === actorId) {
    return { ok: false, error: SELF_CHANGE_ERROR };
  }

  try {
    await setUserRole(targetId, role);
  } catch {
    // The underlying Clerk message can name internal ids and is not useful to
    // an operator, so it is replaced. Nothing is revalidated on this path —
    // the stored role did not change.
    return { ok: false, error: WRITE_FAILED_ERROR };
  }

  revalidatePath(ACCESS_PATH);

  return { ok: true, userId: targetId, role };
}
