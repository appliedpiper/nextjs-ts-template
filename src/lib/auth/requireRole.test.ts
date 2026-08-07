// @vitest-environment node
//
// The /admin/* layout guard. Same policy as the proxy, enforced at the resource,
// so both layers are covered independently.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  state: {
    userId: null as string | null,
    sessionClaims: null as unknown,
  },
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({
    userId: hoisted.state.userId,
    sessionClaims: hoisted.state.sessionClaims,
  }),
}));

// Next's real `redirect()` throws to unwind rendering; the mock does the same so
// the tests prove execution actually stops rather than falling through.
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));

import { getCurrentRole, requireRole } from './requireRole';

function signIn(userId: string, role?: 'admin' | 'user') {
  hoisted.state.userId = userId;
  hoisted.state.sessionClaims = role ? { metadata: { role } } : { metadata: {} };
}

beforeEach(() => {
  hoisted.state.userId = null;
  hoisted.state.sessionClaims = null;
});

describe('requireRole', () => {
  it('redirects an unauthenticated request to sign-in', async () => {
    await expect(requireRole('admin')).rejects.toThrow('NEXT_REDIRECT:/sign-in');
  });

  it('redirects a user-role request that requires admin', async () => {
    signIn('user_123', 'user');

    await expect(requireRole('admin')).rejects.toThrow('NEXT_REDIRECT:/');
  });

  it('returns the identity for an admin-role request that requires admin', async () => {
    signIn('admin_456', 'admin');

    await expect(requireRole('admin')).resolves.toEqual({
      userId: 'admin_456',
      role: 'admin',
    });
  });

  it('redirects when the role claim is missing and admin is required', async () => {
    signIn('user_789');

    await expect(requireRole('admin')).rejects.toThrow('NEXT_REDIRECT:/');
  });

  it('allows any signed-in user when only the user role is required', async () => {
    signIn('user_789');

    await expect(requireRole('user')).resolves.toEqual({
      userId: 'user_789',
      role: undefined,
    });
  });
});

describe('getCurrentRole', () => {
  it('reports the signed-in role', async () => {
    signIn('admin_456', 'admin');

    await expect(getCurrentRole()).resolves.toBe('admin');
  });

  it('reports undefined when no role claim is present', async () => {
    signIn('user_789');

    await expect(getCurrentRole()).resolves.toBeUndefined();
  });
});
