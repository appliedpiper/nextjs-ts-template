'use client';

// Apollo's embedded Sandbox, pointed at this app's own `/api/graphql`.
//
// WHY THIS EXISTS: querying the GraphQL API by hand otherwise means minting a
// Clerk token and pasting it into a header, and those tokens expire in ~60s. By
// hosting the IDE on this origin, the browser already holds the Clerk session
// cookie, `/api/graphql` converts it into a Bearer token server-side, and no
// token is ever handled manually.
//
// This component holds NO authorization. The page is protected by `proxy.ts`
// (every `/admin` path is admin-only) and by `requireRole('admin')` in the
// admin layout and the page itself. Rendering an IDE is not a privilege;
// `/api/graphql` and the backend each re-check every request independently.

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import { useEffect, useRef, useState } from 'react';

// Loaded from Apollo's CDN rather than bundled, so this adds no dependency.
// Pinned to the v2 path rather than `_latest` so an upstream change cannot
// alter the IDE under us without a commit here.
const SANDBOX_SCRIPT =
  'https://embeddable-sandbox.cdn.apollographql.com/v2/embeddable-sandbox.umd.production.min.js';

const CONTAINER_ID = 'embedded-sandbox';

// The app's own API route. Same origin, which is the entire point: a
// cross-origin endpoint would not receive the Clerk cookie.
const ENDPOINT = '/api/graphql';

type EmbeddedSandboxOptions = {
  target: string;
  initialEndpoint: string;
  hideCookieToggle?: boolean;
  handleRequest?: (url: string, options: RequestInit) => Promise<Response>;
};

type SandboxGlobal = {
  EmbeddedSandbox?: new (options: EmbeddedSandboxOptions) => unknown;
};

export function GraphqlSandbox() {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function mount() {
      if (cancelled) return;

      const Sandbox = (window as unknown as SandboxGlobal).EmbeddedSandbox;
      if (!Sandbox) {
        setFailed(true);
        return;
      }

      new Sandbox({
        target: `#${CONTAINER_ID}`,
        initialEndpoint: ENDPOINT,
        // The cookie is always sent by `handleRequest` below, so offering a
        // toggle for it would misrepresent what the IDE is doing.
        hideCookieToggle: true,
        // Supplying this explicitly rather than relying on the embed's
        // `includeCookies` flag: its *default* handler sets
        // `credentials: 'omit'`, which would strip the Clerk cookie and make
        // every query come back UNAUTHENTICATED. This is the line that makes
        // the whole page work.
        handleRequest: (url, options) =>
          fetch(url, { ...options, credentials: 'same-origin' }),
      });
    }

    // Reuse the tag if the component remounts (React strict mode double-invokes
    // effects in dev), otherwise a second script load re-registers the embed.
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SANDBOX_SCRIPT}"]`,
    );

    if ((window as unknown as SandboxGlobal).EmbeddedSandbox) {
      mount();
    } else if (existing) {
      existing.addEventListener('load', mount);
      existing.addEventListener('error', () => setFailed(true));
    } else {
      const script = document.createElement('script');
      script.src = SANDBOX_SCRIPT;
      script.async = true;
      script.addEventListener('load', mount);
      script.addEventListener('error', () => setFailed(true));
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {/* Permanently mounted rather than conditionally rendered, so a load
          failure changes content instead of restructuring the tree — the same
          rule the access page's file header records. */}
      <Box role="status" aria-live="polite">
        {failed ? (
          <Alert severity="error">
            The GraphQL IDE could not be loaded from Apollo&apos;s CDN. It is
            fetched at runtime rather than bundled, so this page needs network
            access to <code>embeddable-sandbox.cdn.apollographql.com</code>.
            Queries can still be run with <code>pnpm dev:token</code> and curl.
          </Alert>
        ) : null}
      </Box>

      <Box
        id={CONTAINER_ID}
        ref={container}
        sx={{
          // The embed renders an iframe that fills its container, so the
          // container needs an explicit height or it collapses to nothing.
          height: { xs: '60vh', md: '75vh' },
          minHeight: 420,
          width: '100%',
          '& iframe': { border: 0, width: '100%', height: '100%' },
        }}
      />
    </>
  );
}
