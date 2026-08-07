// Server-side role enforcement for pages, layouts, and route handlers.
//
// The proxy already redirects unauthorized requests, but that is an edge check.
// Calling this in a layout or page enforces the same policy at the resource
// itself, so a route stays protected even if the proxy matcher changes.

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { FORBIDDEN_REDIRECT_PATH, SIGN_IN_PATH } from './access';
import { getRole, satisfiesRole, type Role } from './roles';

export async function getCurrentRole(): Promise<Role | undefined> {
  const { sessionClaims } = await auth();
  return getRole(sessionClaims);
}

/**
 * Redirects unless the signed-in user satisfies `required`, then returns the
 * resolved identity. Both branches call `redirect()`, which throws, so anything
 * after this call has already passed the check.
 */
export async function requireRole(required: Role) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect(SIGN_IN_PATH);
  }

  const role = getRole(sessionClaims);

  if (!satisfiesRole(role, required)) {
    redirect(FORBIDDEN_REDIRECT_PATH);
  }

  return { userId, role };
}
