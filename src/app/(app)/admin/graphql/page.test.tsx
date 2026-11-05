import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  requireRole: vi.fn(),
}));

vi.mock('@/lib/auth/requireRole', () => ({ requireRole: hoisted.requireRole }));

// The IDE itself is covered by GraphqlSandbox.test.tsx. Stubbed here so this
// file tests what the *page* decides: who may see it, and in which environment.
vi.mock('@/components/graphql/GraphqlSandbox', () => ({
  GraphqlSandbox: () => <div data-testid="sandbox" />,
}));

import Page from './page';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

function setNodeEnv(value: string | undefined) {
  // NODE_ENV is read-only in the Next types, so assign through a cast.
  if (value === undefined) {
    delete (process.env as Record<string, string | undefined>).NODE_ENV;
  } else {
    (process.env as Record<string, string | undefined>).NODE_ENV = value;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.requireRole.mockResolvedValue({ userId: 'user_admin', role: 'admin' });
});

afterEach(() => {
  setNodeEnv(ORIGINAL_NODE_ENV);
});

describe('authorization', () => {
  it('demands the admin role', async () => {
    render(await Page());

    expect(hoisted.requireRole).toHaveBeenCalledWith('admin');
  });

  it('renders nothing when requireRole redirects a non-admin away', async () => {
    // requireRole signals refusal by calling redirect(), which throws.
    hoisted.requireRole.mockRejectedValue(new Error('NEXT_REDIRECT'));

    await expect(Page()).rejects.toThrow('NEXT_REDIRECT');
  });

  it('checks the role before deciding anything else', async () => {
    // The page's own guard is deliberately redundant with the admin layout's.
    // If this were skipped, the IDE would depend solely on the layout and the
    // proxy — and reads are not scoped per customer, so an IDE reaching a
    // non-admin would expose every customer's records.
    hoisted.requireRole.mockRejectedValue(new Error('NEXT_REDIRECT'));
    setNodeEnv('production');

    await expect(Page()).rejects.toThrow('NEXT_REDIRECT');
  });
});

describe('outside production', () => {
  it.each(['development', 'test', undefined])('renders the IDE when NODE_ENV is %s', async (value) => {
    setNodeEnv(value);

    render(await Page());

    expect(screen.getByTestId('sandbox')).toBeInTheDocument();
  });

  it('explains that no token handling is needed', async () => {
    setNodeEnv('development');

    render(await Page());

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('GraphQL');
    expect(screen.getByText(/no token to copy/i)).toBeInTheDocument();
  });

  it('names the route that supplies the credential', async () => {
    setNodeEnv('development');

    render(await Page());

    expect(screen.getByText('/api/graphql')).toBeInTheDocument();
  });
});

describe('in production', () => {
  beforeEach(() => setNodeEnv('production'));

  it('does not render the IDE', async () => {
    render(await Page());

    expect(screen.queryByTestId('sandbox')).not.toBeInTheDocument();
  });

  it('says why, rather than showing a broken IDE', async () => {
    // Apollo disables introspection in production, so the embed would load
    // with no schema, no docs and no autocomplete.
    render(await Page());

    expect(screen.getByText(/disabled in production/i)).toBeInTheDocument();
    expect(screen.getByText(/introspection/i)).toBeInTheDocument();
  });

  it('still requires admin — the refusal is not a way around the gate', async () => {
    render(await Page());

    expect(hoisted.requireRole).toHaveBeenCalledWith('admin');
  });
});
