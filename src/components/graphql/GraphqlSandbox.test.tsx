import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GraphqlSandbox } from './GraphqlSandbox';

const SCRIPT_SRC =
  'https://embeddable-sandbox.cdn.apollographql.com/v2/embeddable-sandbox.umd.production.min.js';

type SandboxOptions = {
  target: string;
  initialEndpoint: string;
  hideCookieToggle?: boolean;
  handleRequest?: (url: string, options: RequestInit) => Promise<Response>;
};

let constructed: SandboxOptions[];

function installSandboxGlobal() {
  (window as unknown as { EmbeddedSandbox?: unknown }).EmbeddedSandbox = class {
    constructor(options: SandboxOptions) {
      constructed.push(options);
    }
  };
}

function removeSandboxGlobal() {
  delete (window as unknown as { EmbeddedSandbox?: unknown }).EmbeddedSandbox;
}

/** The script tag the component injects, if any. */
function injectedScript() {
  return document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
}

beforeEach(() => {
  constructed = [];
  removeSandboxGlobal();
  document.querySelectorAll('script').forEach((s) => s.remove());
});

afterEach(() => {
  removeSandboxGlobal();
  vi.restoreAllMocks();
});

describe('loading the embed', () => {
  it('injects the Apollo CDN script when the global is not yet present', () => {
    render(<GraphqlSandbox />);

    const script = injectedScript();
    expect(script).not.toBeNull();
    expect(script?.async).toBe(true);
  });

  it('pins a versioned CDN path rather than _latest', () => {
    // So an upstream release cannot change the IDE without a commit here.
    render(<GraphqlSandbox />);

    expect(injectedScript()?.src).toContain('/v2/');
    expect(injectedScript()?.src).not.toContain('_latest');
  });

  it('constructs the sandbox once the script loads', async () => {
    render(<GraphqlSandbox />);
    installSandboxGlobal();
    injectedScript()?.dispatchEvent(new Event('load'));

    await waitFor(() => expect(constructed).toHaveLength(1));
  });

  it('constructs immediately when the global already exists, without a second script', () => {
    // Happens on remount — React strict mode double-invokes effects in dev.
    installSandboxGlobal();

    render(<GraphqlSandbox />);

    expect(constructed).toHaveLength(1);
    expect(injectedScript()).toBeNull();
  });

  it('reuses an existing script tag instead of adding another', async () => {
    const existing = document.createElement('script');
    existing.src = SCRIPT_SRC;
    document.head.appendChild(existing);

    render(<GraphqlSandbox />);

    expect(document.querySelectorAll(`script[src="${SCRIPT_SRC}"]`)).toHaveLength(1);

    installSandboxGlobal();
    existing.dispatchEvent(new Event('load'));
    await waitFor(() => expect(constructed).toHaveLength(1));
  });
});

describe('the options it passes — this is what makes auth work', () => {
  beforeEach(() => {
    installSandboxGlobal();
    render(<GraphqlSandbox />);
  });

  it('points at the app\'s own same-origin API route', () => {
    // A cross-origin endpoint would never receive the Clerk cookie, which is
    // the entire mechanism this page relies on.
    expect(constructed[0].initialEndpoint).toBe('/api/graphql');
  });

  it('targets the container the component renders', () => {
    expect(constructed[0].target).toBe('#embedded-sandbox');
    expect(document.querySelector('#embedded-sandbox')).not.toBeNull();
  });

  it('supplies handleRequest, rather than relying on the embed default', () => {
    // The embed's own default handler sets `credentials: 'omit'`, which strips
    // the Clerk cookie and makes every query UNAUTHENTICATED.
    expect(typeof constructed[0].handleRequest).toBe('function');
  });

  it('forces same-origin credentials on every request it makes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await constructed[0].handleRequest?.('/api/graphql', {
      method: 'POST',
      body: '{"query":"{__typename}"}',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/graphql');
    expect(init.credentials).toBe('same-origin');
  });

  it('preserves the options the embed passed through', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await constructed[0].handleRequest?.('/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"query":"{ users { _id } }"}',
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"query":"{ users { _id } }"}');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('hides the cookie toggle, since cookies are always sent', () => {
    expect(constructed[0].hideCookieToggle).toBe(true);
  });
});

describe('when the CDN is unreachable', () => {
  it('explains the failure instead of rendering an empty page', async () => {
    render(<GraphqlSandbox />);
    injectedScript()?.dispatchEvent(new Event('error'));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/could not be loaded/i),
    );
  });

  it('points at the working fallback for running queries', async () => {
    render(<GraphqlSandbox />);
    injectedScript()?.dispatchEvent(new Event('error'));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/dev:token/));
  });

  it('reports failure if the script loads but exposes no global', async () => {
    render(<GraphqlSandbox />);
    // Loaded, but EmbeddedSandbox was never installed — e.g. a CDN serving an
    // error page with a 200.
    injectedScript()?.dispatchEvent(new Event('load'));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/could not be loaded/i),
    );
    expect(constructed).toHaveLength(0);
  });

  it('keeps the status region mounted when nothing is wrong', () => {
    installSandboxGlobal();
    render(<GraphqlSandbox />);

    // Always present, empty — content changes rather than the tree
    // restructuring, which is the DOM-stability rule this codebase follows.
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});
