// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  decideAccess,
  isAdminPath,
  isPublicPath,
  requiredRoleFor,
  type AccessDecision,
} from './access';
import type { Role } from './roles';

function decide(
  pathname: string,
  userId: string | null,
  role?: Role,
): AccessDecision['kind'] {
  return decideAccess({ pathname, userId, role }).kind;
}

const SIGNED_IN = 'user_123';

describe('decideAccess — the three required cases', () => {
  it('sends an unauthenticated request to a protected route to sign-in', () => {
    expect(decide('/', null)).toBe('redirect-sign-in');
  });

  it('blocks a user-role request to an /admin/* route', () => {
    expect(decide('/admin/users', SIGNED_IN, 'user')).toBe('redirect-forbidden');
  });

  it('allows an admin-role request to an /admin/* route', () => {
    expect(decide('/admin/users', SIGNED_IN, 'admin')).toBe('allow');
  });
});

describe('decideAccess — unauthenticated', () => {
  it('sends an unauthenticated /admin/* request to sign-in, not to forbidden', () => {
    // A signed-out visitor shouldn't learn that an admin route exists.
    expect(decide('/admin/users', null)).toBe('redirect-sign-in');
  });

  it('allows the sign-in page itself so the redirect cannot loop', () => {
    expect(decide('/sign-in', null)).toBe('allow');
  });

  it("allows Clerk's sub-routes beneath /sign-in", () => {
    expect(decide('/sign-in/factor-one', null)).toBe('allow');
    expect(decide('/sign-in/sso-callback', null)).toBe('allow');
  });

  it('treats an empty-string user id as unauthenticated', () => {
    expect(decide('/', '')).toBe('redirect-sign-in');
  });
});

describe('decideAccess — signed in on non-admin routes', () => {
  it('allows the user role', () => {
    expect(decide('/', SIGNED_IN, 'user')).toBe('allow');
  });

  it('allows the admin role', () => {
    expect(decide('/', SIGNED_IN, 'admin')).toBe('allow');
  });

  it('allows a signed-in user whose role claim is missing', () => {
    // Non-admin routes require only a session, so this still works before the
    // Clerk Dashboard session claim is configured.
    expect(decide('/', SIGNED_IN, undefined)).toBe('allow');
  });
});

describe('decideAccess — admin routes fail closed', () => {
  it('forbids a signed-in user whose role claim is missing entirely', () => {
    // The likeliest misconfiguration: the Dashboard claim isn't set, so no role
    // ever reaches the token. It must deny rather than wave the request through.
    expect(decide('/admin/users', SIGNED_IN, undefined)).toBe('redirect-forbidden');
  });

  it('forbids the bare /admin route for a non-admin', () => {
    expect(decide('/admin', SIGNED_IN, 'user')).toBe('redirect-forbidden');
  });

  it('forbids nested admin routes for a non-admin', () => {
    expect(decide('/admin/users/settings/danger', SIGNED_IN, 'user')).toBe(
      'redirect-forbidden',
    );
  });
});

describe('path matching', () => {
  it('does not treat a route that merely starts with "admin" as an admin route', () => {
    expect(isAdminPath('/administrators')).toBe(false);
    expect(decide('/administrators', SIGNED_IN, 'user')).toBe('allow');
  });

  it('matches /admin and its subtree', () => {
    expect(isAdminPath('/admin')).toBe(true);
    expect(isAdminPath('/admin/')).toBe(true);
    expect(isAdminPath('/admin/users')).toBe(true);
  });

  it('does not treat a route that merely starts with "sign-in" as public', () => {
    expect(isPublicPath('/sign-in-help')).toBe(false);
    expect(decide('/sign-in-help', null)).toBe('redirect-sign-in');
  });

  it('reports the role each path requires', () => {
    expect(requiredRoleFor('/admin/users')).toBe('admin');
    expect(requiredRoleFor('/')).toBe('user');
  });
});
