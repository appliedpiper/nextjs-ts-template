import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { APP_NAME } from '@/lib/appConfig';
import type { Role } from '@/lib/auth/roles';
import { SIDEBAR_COOKIE } from '@/lib/layout/sidebarPreference';
import type { NavSection } from '@/lib/navigation/types';

const hoisted = vi.hoisted(() => ({
  role: { current: undefined as Role | undefined },
  cookieValue: { current: undefined as string | undefined },
  shellProps: {
    current: null as null | {
      title?: string;
      sections?: NavSection[];
      defaultOpen?: boolean;
      actions?: React.ReactNode;
    },
  },
}));

vi.mock('@/lib/auth/requireRole', () => ({
  getCurrentRole: () => Promise.resolve(hoisted.role.current),
}));

vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        name === SIDEBAR_COOKIE && hoisted.cookieValue.current !== undefined
          ? { name, value: hoisted.cookieValue.current }
          : undefined,
    }),
}));

// Standing in for the shell keeps this test about what DefaultLayout *decides* —
// the filtered nav, the stored width, the per-user actions — rather than
// re-testing chrome that step 4 already covers.
vi.mock('./AppShell', () => ({
  AppShell: (props: {
    title?: string;
    sections?: NavSection[];
    defaultOpen?: boolean;
    actions?: React.ReactNode;
    children?: React.ReactNode;
  }) => {
    hoisted.shellProps.current = props;
    return (
      <div data-testid="app-shell">
        <div data-testid="actions">{props.actions}</div>
        {props.children}
      </div>
    );
  },
}));

import DefaultLayout from './DefaultLayout';

/** Server components are async, so resolve the element before rendering it. */
async function renderLayout(props: { title?: string } = {}) {
  const element = await DefaultLayout({ children: <p>Page body</p>, ...props });
  return render(element);
}

function navIds(): string[] {
  return (hoisted.shellProps.current?.sections ?? []).flatMap((s) => s.items.map((i) => i.id));
}

beforeEach(() => {
  hoisted.role.current = undefined;
  hoisted.cookieValue.current = undefined;
  hoisted.shellProps.current = null;
});

describe('DefaultLayout', () => {
  it('renders the page inside the shell', async () => {
    await renderLayout();

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByText('Page body')).toBeInTheDocument();
  });

  it('titles the shell with the app name by default', async () => {
    await renderLayout();

    expect(hoisted.shellProps.current?.title).toBe(APP_NAME);
  });

  it('lets a caller override the title', async () => {
    await renderLayout({ title: 'Ops Console' });

    expect(hoisted.shellProps.current?.title).toBe('Ops Console');
  });

  describe('role-based navigation', () => {
    it('gives an admin the admin entries', async () => {
      hoisted.role.current = 'admin';
      await renderLayout();

      expect(navIds()).toContain('customers');
      expect(navIds()).toContain('dashboard');
    });

    it('withholds admin entries from a plain user', async () => {
      hoisted.role.current = 'user';
      await renderLayout();

      expect(navIds()).not.toContain('customers');
      expect(navIds()).toContain('dashboard');
    });

    // The Clerk session claim is a manual prerequisite, so this is the state the
    // app is actually in until it's configured. It must fail closed.
    it('withholds admin entries when the role claim is missing', async () => {
      hoisted.role.current = undefined;
      await renderLayout();

      expect(navIds()).not.toContain('customers');
    });
  });

  describe('sidebar preference', () => {
    it('passes the stored collapsed state through to the shell', async () => {
      hoisted.cookieValue.current = 'false';
      await renderLayout();

      expect(hoisted.shellProps.current?.defaultOpen).toBe(false);
    });

    it('passes the stored expanded state through', async () => {
      hoisted.cookieValue.current = 'true';
      await renderLayout();

      expect(hoisted.shellProps.current?.defaultOpen).toBe(true);
    });

    it('defaults to expanded with no cookie set', async () => {
      hoisted.cookieValue.current = undefined;
      await renderLayout();

      expect(hoisted.shellProps.current?.defaultOpen).toBe(true);
    });

    it('defaults to expanded for a corrupt cookie rather than throwing', async () => {
      hoisted.cookieValue.current = 'not-a-boolean';
      await renderLayout();

      expect(hoisted.shellProps.current?.defaultOpen).toBe(true);
    });
  });

  describe('per-user header actions', () => {
    it("shows the signed-in user's role", async () => {
      hoisted.role.current = 'admin';
      await renderLayout();

      expect(screen.getByTestId('actions')).toHaveTextContent('admin');
    });

    it('differs for a different role, which is the point of the slot', async () => {
      hoisted.role.current = 'user';
      await renderLayout();

      expect(screen.getByTestId('actions')).toHaveTextContent('user');
      expect(screen.getByTestId('actions')).not.toHaveTextContent('admin');
    });

    it('flags a missing role rather than hiding it', async () => {
      hoisted.role.current = undefined;
      await renderLayout();

      expect(screen.getByTestId('actions')).toHaveTextContent('no role');
    });
  });
});
