// Composes the real tree — DefaultLayout → AppShell → AppHeader + AppSidebar —
// with only the external boundaries stubbed (Clerk, next/headers, next/navigation,
// next/link).
//
// DefaultLayout.test.tsx mocks AppShell to assert what this component *decides*.
// This file exists to catch the opposite class of bug: the pieces individually
// passing their own tests but failing to assemble, which unit tests with a mocked
// shell cannot see. It is the closest thing to a signed-in page render available
// without a live Clerk session.

import { ThemeProvider } from '@mui/material/styles';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Role } from '@/lib/auth/roles';
import { theme } from '@/lib/theme';

const hoisted = vi.hoisted(() => ({
  role: { current: undefined as Role | undefined },
  pathname: { current: '/' },
}));

vi.mock('@/lib/auth/requireRole', () => ({
  getCurrentRole: () => Promise.resolve(hoisted.role.current),
}));

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: () => undefined }),
}));

vi.mock('next/navigation', () => ({ usePathname: () => hoisted.pathname.current }));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@clerk/nextjs', () => ({
  UserButton: () => <div data-testid="user-button" />,
}));

import DefaultLayout from './DefaultLayout';

async function renderPage() {
  const element = await DefaultLayout({ children: <h1>Users</h1> });
  return render(<ThemeProvider theme={theme}>{element}</ThemeProvider>);
}

beforeEach(() => {
  hoisted.role.current = 'admin';
  hoisted.pathname.current = '/';
  window.matchMedia = ((query: string) => ({
    matches: query.includes('min-width'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

describe('DefaultLayout, fully composed', () => {
  it('renders page content, header, nav, and user menu together', async () => {
    await renderPage();

    expect(screen.getByRole('heading', { name: 'Users' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /navigation$/ })).toBeInTheDocument();
    expect(screen.getByTestId('user-button')).toBeInTheDocument();
  });

  it('puts the page inside the main landmark, beside the nav', async () => {
    await renderPage();

    expect(within(screen.getByRole('main')).getByRole('heading', { name: 'Users' })).toBeInTheDocument();
  });

  it('shows the app name and the per-user role badge in the header', async () => {
    await renderPage();

    expect(screen.getByText('NextJS Frontend Template')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  describe('what each role actually sees', () => {
    it('gives an admin a working link to the customers page', async () => {
      hoisted.role.current = 'admin';
      await renderPage();

      expect(screen.getByRole('link', { name: 'Customers' })).toHaveAttribute(
        'href',
        '/admin/customers',
      );
    });

    it('gives an admin a working link to the access page', async () => {
      hoisted.role.current = 'admin';
      await renderPage();

      expect(screen.getByRole('link', { name: 'Access' })).toHaveAttribute(
        'href',
        '/admin/access',
      );
    });

    it('gives a plain user no admin link at all', async () => {
      hoisted.role.current = 'user';
      await renderPage();

      expect(screen.queryByRole('link', { name: 'Customers' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Access' })).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    });

    it('also hides it when the role claim is missing, and says why', async () => {
      hoisted.role.current = undefined;
      await renderPage();

      expect(screen.queryByRole('link', { name: 'Customers' })).not.toBeInTheDocument();
      expect(screen.getByText('no role')).toBeInTheDocument();
    });

    it('never renders the Settings placeholder as a link, for any role', async () => {
      for (const role of ['admin', 'user', undefined] as const) {
        hoisted.role.current = role;
        const { unmount } = await renderPage();

        expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
        unmount();
      }
    });
  });

  it('highlights the nav entry matching the current page', async () => {
    hoisted.pathname.current = '/admin/customers';
    await renderPage();

    expect(screen.getByRole('link', { name: 'Customers' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByLabelText('Breadcrumb')).toHaveTextContent('Customers');
  });
});
