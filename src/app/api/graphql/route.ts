// The browser's only route to the GraphQL API, and now an enforcement point
// rather than a transparent proxy.
//
// Two things happen here that did not before:
//
//  1. The request is refused with a real 401 JSON body when there is no
//     session. `src/proxy.ts` also covers this path, but it answers with a 307
//     to the sign-in page — correct for a navigation, useless for a `fetch`,
//     which would fail trying to parse HTML as JSON. This is the resource-level
//     check, the same argument as `requireRole` versus the proxy for pages.
//
//  2. The caller's Clerk session token is attached as a Bearer header. The
//     backend verifies it and derives the identity and role from it, so this
//     route is where the browser's session becomes an API credential. Without
//     the header, every backend resolver refuses the request.
//
// The token is minted per request and short-lived (Clerk refreshes roughly
// every 60s), so a role change reaches the API on the next refresh.

import { auth } from "@clerk/nextjs/server";

import { getServerEnv } from "@/lib/env/server";

// GraphQL convention: errors travel in the body, so return a well-formed
// GraphQL error shape rather than a bare string. `graphqlFetch` surfaces
// `errors[].message`, which means the client shows this text as-is.
const UNAUTHENTICATED_BODY = {
  errors: [
    {
      message: "You must be signed in to query the API.",
      extensions: { code: "UNAUTHENTICATED" },
    },
  ],
};

// Infrastructure failures get a message that names the cause, unlike the auth
// refusals above. Saying "the API is unreachable" leaks nothing an attacker
// could use, and the alternative is what actually happened once: a dead backend
// surfacing in the UI as an unexplained "Error loading users" with an opaque
// 500 in the logs.
function upstreamErrorBody(message: string, code: string) {
  return { errors: [{ message, extensions: { code } }] };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: Request) {
  const { userId, getToken } = await auth();

  // Refused before the body is read and before anything is forwarded, so an
  // unauthenticated request never reaches the backend at all.
  if (!userId) {
    return json(UNAUTHENTICATED_BODY, 401);
  }

  const token = await getToken();

  // A signed-in session that cannot mint a token is not something to forward
  // unauthenticated — the backend would refuse it anyway, but failing here
  // keeps the reason accurate.
  if (!token) {
    return json(UNAUTHENTICATED_BODY, 401);
  }

  const { GRAPHQL_SERVER } = getServerEnv();
  const body = await request.json();

  let upstream: Response;
  try {
    upstream = await fetch(GRAPHQL_SERVER, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    // The GraphQL server is down, crash-looping, or the hostname doesn't
    // resolve. Without this the rejection escapes as an unhandled error and
    // Next answers 500 with nothing useful in it.
    console.error(
      `[api/graphql] cannot reach GRAPHQL_SERVER (${GRAPHQL_SERVER}):`,
      error instanceof Error ? error.message : error,
    );
    return json(
      upstreamErrorBody(
        "The GraphQL API is unreachable. Check that the backend is running.",
        "BACKEND_UNREACHABLE",
      ),
      502,
    );
  }

  // A backend that answers with HTML (a proxy error page) or an empty body
  // would otherwise throw here and become the same opaque 500.
  let data: unknown;
  try {
    data = await upstream.json();
  } catch {
    console.error(
      `[api/graphql] non-JSON response from GRAPHQL_SERVER: HTTP ${upstream.status}`,
    );
    return json(
      upstreamErrorBody(
        `The GraphQL API returned a non-JSON response (HTTP ${upstream.status}).`,
        "BACKEND_BAD_RESPONSE",
      ),
      502,
    );
  }

  return json(data, upstream.status);
}
