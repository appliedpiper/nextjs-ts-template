// The single authorization policy for the app, as a pure function.
//
// `src/proxy.ts` is a thin adapter over `decideAccess` and nothing else, which
// keeps the policy testable without mocking Clerk or Next internals.

import { satisfiesRole, type Role } from './roles';

export const SIGN_IN_PATH = '/sign-in';

// Where a signed-in user who lacks the required role is sent.
export const FORBIDDEN_REDIRECT_PATH = '/';

// Everything not listed here requires authentication. Clerk renders its own
// sub-routes beneath /sign-in (factor-one, sso-callback, ...), so prefixes
// match the whole subtree.
export const PUBLIC_PATHS = [SIGN_IN_PATH] as const;

export type AccessDecision =
  | { kind: 'allow' }
  | { kind: 'redirect-sign-in' }
  | { kind: 'redirect-forbidden' };

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((prefix) => matchesPrefix(pathname, prefix));
}

// Segment-aware so sibling paths like /administrators are not treated as admin.
export function isAdminPath(pathname: string): boolean {
  return matchesPrefix(pathname, '/admin');
}

export function requiredRoleFor(pathname: string): Role {
  return isAdminPath(pathname) ? 'admin' : 'user';
}

export function decideAccess(input: {
  pathname: string;
  userId: string | null | undefined;
  role: Role | undefined;
}): AccessDecision {
  const { pathname, userId, role } = input;

  if (isPublicPath(pathname)) {
    return { kind: 'allow' };
  }

  // Unauthenticated always goes to sign-in, including for /admin/* — a visitor
  // shouldn't be told a route exists but is forbidden before signing in.
  if (!userId) {
    return { kind: 'redirect-sign-in' };
  }

  if (!satisfiesRole(role, requiredRoleFor(pathname))) {
    return { kind: 'redirect-forbidden' };
  }

  return { kind: 'allow' };
}
