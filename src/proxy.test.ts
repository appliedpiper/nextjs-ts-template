// @vitest-environment node
//
// Verifies the proxy adapter turns a policy decision into a real Response.
// The policy itself is covered exhaustively in src/lib/auth/access.test.ts.

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const SIGN_IN_RESPONSE = new Response(null, {
  status: 307,
  headers: { location: '/sign-in' },
});

const hoisted = vi.hoisted(() => ({
  state: {
    userId: null as string | null,
    sessionClaims: null as unknown,
  },
  redirectToSignIn: vi.fn(),
}));

type MiddlewareHandler = (
  auth: () => Promise<unknown>,
  req: NextRequest,
  evt: unknown,
) => Promise<Response | undefined>;

// Stand in for Clerk so the test controls the session rather than the network.
vi.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware:
    (handler: MiddlewareHandler) => (req: NextRequest, evt: unknown) =>
      handler(
        async () => ({
          userId: hoisted.state.userId,
          sessionClaims: hoisted.state.sessionClaims,
          redirectToSignIn: hoisted.redirectToSignIn,
        }),
        req,
        evt,
      ),
}));

import proxy from '@/proxy';

const invoke = proxy as unknown as (req: NextRequest) => Promise<Response>;

function request(pathname: string) {
  return new NextRequest(new URL(pathname, 'http://localhost:3000'));
}

function signIn(userId: string, role?: 'admin' | 'user') {
  hoisted.state.userId = userId;
  hoisted.state.sessionClaims = role ? { metadata: { role } } : { metadata: {} };
}

beforeEach(() => {
  hoisted.state.userId = null;
  hoisted.state.sessionClaims = null;
  hoisted.redirectToSignIn.mockReset();
  hoisted.redirectToSignIn.mockReturnValue(SIGN_IN_RESPONSE);
});

describe('unauthenticated requests', () => {
  it('redirects a protected route to sign-in', async () => {
    const response = await invoke(request('/'));

    expect(hoisted.redirectToSignIn).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('/sign-in');
  });

  it('passes a return URL so signing in resumes the original destination', async () => {
    await invoke(request('/admin/users'));

    expect(hoisted.redirectToSignIn).toHaveBeenCalledWith({
      returnBackUrl: 'http://localhost:3000/admin/users',
    });
  });

  it('does not redirect the sign-in page itself', async () => {
    const response = await invoke(request('/sign-in'));

    expect(hoisted.redirectToSignIn).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });
});

describe('signed-in requests', () => {
  it('lets a user-role request through on a non-admin route', async () => {
    signIn('user_123', 'user');

    const response = await invoke(request('/'));

    expect(hoisted.redirectToSignIn).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it('redirects a user-role request away from /admin/*', async () => {
    signIn('user_123', 'user');

    const response = await invoke(request('/admin/users'));

    // Redirected, not bounced to sign-in — the session is valid, the role isn't.
    expect(hoisted.redirectToSignIn).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/');
  });

  it('lets an admin-role request through on /admin/*', async () => {
    signIn('admin_456', 'admin');

    const response = await invoke(request('/admin/users'));

    expect(hoisted.redirectToSignIn).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it('redirects away from /admin/* when the role claim is missing', async () => {
    signIn('user_789');

    const response = await invoke(request('/admin/users'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/');
  });
});
