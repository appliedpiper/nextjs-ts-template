// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  auth: vi.fn(),
  getServerEnv: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: hoisted.auth }));
vi.mock('@/lib/env/server', () => ({ getServerEnv: hoisted.getServerEnv }));

import { POST } from './route';

const GRAPHQL_SERVER = 'http://backend:4000/graphql';
const TOKEN = 'session-token-abc';
const QUERY = { query: '{ users { _id } }' };

function post(body: unknown = QUERY): Request {
  return new Request('http://localhost:3000/api/graphql', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function signedIn(token: string | null = TOKEN) {
  hoisted.auth.mockResolvedValue({
    userId: 'user_123',
    getToken: vi.fn().mockResolvedValue(token),
  });
}

function signedOut() {
  hoisted.auth.mockResolvedValue({
    userId: null,
    getToken: vi.fn().mockResolvedValue(null),
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.getServerEnv.mockReturnValue({ GRAPHQL_SERVER });

  fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ data: { users: [] } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
});

describe('unauthenticated requests', () => {
  it('answers 401 rather than redirecting', async () => {
    // The proxy would answer this path with a 307 to /sign-in, which a fetch
    // cannot use. This route has to give the client a real status.
    signedOut();

    const response = await POST(post());

    expect(response.status).toBe(401);
  });

  it('answers with a GraphQL-shaped error body, not HTML', async () => {
    signedOut();

    const response = await POST(post());
    const body = await response.json();

    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
    expect(body.errors[0].message).toBeTruthy();
  });

  it('does not forward anything to the backend', async () => {
    // The load-bearing assertion: an unauthenticated query must not reach the
    // GraphQL server at all, with or without a token.
    signedOut();

    await POST(post());

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses on the missing userId alone, even if a token is somehow available', async () => {
    // Without this the two refusal checks are indistinguishable: a signed-out
    // caller normally also has no token, so the second check masks the first
    // and deleting `if (!userId)` would break no test. Pinned separately so
    // each guard stands on its own.
    hoisted.auth.mockResolvedValue({
      userId: null,
      getToken: vi.fn().mockResolvedValue(TOKEN),
    });

    const response = await POST(post());

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a signed-in session that cannot mint a token', async () => {
    // Forwarding this without an Authorization header would make it an
    // anonymous backend request, which the backend refuses anyway — but then
    // the reported reason would be wrong.
    signedIn(null);

    const response = await POST(post());

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('authenticated requests', () => {
  it('attaches the session token as a Bearer header', async () => {
    signedIn();

    await POST(post());

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('posts to the configured GraphQL server', async () => {
    signedIn();

    await POST(post());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(GRAPHQL_SERVER);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('forwards the query body unchanged', async () => {
    signedIn();

    await POST(post(QUERY));

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual(QUERY);
  });

  it('forwards variables as well as the query', async () => {
    signedIn();
    const withVariables = { query: 'query($id: ID!) { userById(id: $id) { _id } }', variables: { id: '1' } };

    await POST(post(withVariables));

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual(withVariables);
  });

  it('returns the backend payload to the client', async () => {
    signedIn();

    const response = await POST(post());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { users: [] } });
  });
});

describe('upstream failures', () => {
  it('passes a backend 401 through with its status', async () => {
    // The backend refusing a token (expired, or a Clerk instance mismatch) must
    // not be reported to the client as a success.
    signedIn();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: 'nope' }] }), { status: 401 }),
    );

    const response = await POST(post());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ errors: [{ message: 'nope' }] });
  });

  it('passes a backend 403 through with its status', async () => {
    signedIn();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: 'forbidden' }] }), { status: 403 }),
    );

    const response = await POST(post());

    expect(response.status).toBe(403);
  });

  it('preserves a 200 carrying GraphQL errors', async () => {
    // GraphQL answers 200 with an `errors` array for a resolver-level failure;
    // rewriting that status would break the client's error handling.
    signedIn();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: 'boom' }] }), { status: 200 }),
    );

    const response = await POST(post());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ errors: [{ message: 'boom' }] });
  });
});

describe('when the backend is unreachable', () => {
  // This is the case that actually bit: the backend container was crash-looping
  // on a missing module, and the route turned a connection failure into an
  // unhandled rejection -> opaque 500 -> "Error loading users" in the UI with
  // nothing explaining why.
  beforeEach(() => {
    signedIn();
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
  });

  it('answers 502 instead of letting the rejection escape as a 500', async () => {
    const response = await POST(post());

    expect(response.status).toBe(502);
  });

  it('says what is wrong, naming the backend', async () => {
    const response = await POST(post());
    const body = await response.json();

    expect(body.errors[0].extensions.code).toBe('BACKEND_UNREACHABLE');
    expect(body.errors[0].message).toMatch(/unreachable/i);
    expect(body.errors[0].message).toMatch(/backend/i);
  });

  it('does not reject, so Next never sees an unhandled error', async () => {
    const settled = await Promise.allSettled([POST(post())]);

    expect(settled[0].status).toBe('fulfilled');
  });

  it('logs the target so the cause is visible in server output', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});

    await POST(post());

    expect(err).toHaveBeenCalled();
    expect(String(err.mock.calls[0][0])).toContain(GRAPHQL_SERVER);
    err.mockRestore();
  });
});

describe('when the backend returns something that is not JSON', () => {
  // A proxy error page, or an empty body. Without handling, `upstream.json()`
  // throws and produces the same opaque 500.
  beforeEach(() => {
    signedIn();
    fetchMock.mockResolvedValue(
      new Response('<html><body>502 Bad Gateway</body></html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      }),
    );
  });

  it('answers 502 with a parseable GraphQL error rather than throwing', async () => {
    const response = await POST(post());
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.errors[0].extensions.code).toBe('BACKEND_BAD_RESPONSE');
  });

  it('includes the upstream status so the real failure is not hidden', async () => {
    const response = await POST(post());
    const body = await response.json();

    expect(body.errors[0].message).toContain('502');
  });
});

describe('the route\'s own refusal is distinguishable from the backend\'s', () => {
  it('uses a different message than the backend sends, so logs identify the source', async () => {
    // Both use the UNAUTHENTICATED code, which is semantically right on both
    // sides. The wording is what tells you which hop refused: this route says
    // "query the API", the backend says "perform this action".
    signedOut();

    const response = await POST(post());
    const body = await response.json();

    expect(body.errors[0].message).toMatch(/query the API/);
    expect(body.errors[0].message).not.toMatch(/perform this action/);
  });
});

describe('what the route does not do', () => {
  it('does not log the request body', async () => {
    // It used to console.log every query on every request. Queries can carry
    // identifiers and arguments, and this runs on the server, so they would
    // land in server logs.
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    signedIn();

    await POST(post());

    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
