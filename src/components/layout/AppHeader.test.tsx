import { ThemeProvider } from '@mui/material/styles';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { theme } from '@/lib/theme';
import type { NavIcon, NavItem, NavSection } from '@/lib/navigation/types';

const { pathnameRef, clerkProps } = vi.hoisted(() => ({
  pathnameRef: { current: '/' },
  clerkProps: { current: null as { appearance?: { variables?: Record<string, unknown> } } | null },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameRef.current,
}));

// Clerk's UserButton needs a live Clerk context. Standing in for it also lets us
// inspect the appearance it was handed.
vi.mock('@clerk/nextjs', () => ({
  UserButton: (props: { appearance?: { variables?: Record<string, unknown> } }) => {
    clerkProps.current = props;
    return <div data-testid="user-button" />;
  },
}));

import { AppHeader } from './AppHeader';

const Icon = (() => null) as unknown as NavIcon;

function item(overrides: Partial<NavItem> & Pick<NavItem, 'id'>): NavItem {
  return { label: overrides.id, icon: Icon, ...overrides };
}

const sections: NavSection[] = [
  { id: 'overview', items: [item({ id: 'Dashboard', href: '/', exact: true })] },
  {
    id: 'administration',
    label: 'Administration',
    items: [item({ id: 'Users', href: '/admin/users' }), item({ id: 'Settings' })],
  },
];

function renderHeader(props: Partial<React.ComponentProps<typeof AppHeader>> = {}) {
  const onToggleSidebar = props.onToggleSidebar ?? vi.fn();

  const result = render(
    <ThemeProvider theme={theme}>
      <AppHeader
        title="Test App"
        sections={sections}
        sidebarOpen
        onToggleSidebar={onToggleSidebar}
        {...props}
      />
    </ThemeProvider>,
  );

  return { ...result, onToggleSidebar };
}

describe('AppHeader', () => {
  it('renders the app title', () => {
    renderHeader();

    expect(screen.getByText('Test App')).toBeInTheDocument();
  });

  describe('sidebar toggle', () => {
    it('calls onToggleSidebar when clicked', () => {
      const onToggleSidebar = vi.fn();
      renderHeader({ onToggleSidebar });

      fireEvent.click(screen.getByRole('button', { name: 'Collapse navigation' }));

      expect(onToggleSidebar).toHaveBeenCalledTimes(1);
    });

    // The label has to describe the action, not the state, or it tells a screen
    // reader the opposite of what the button does.
    it('describes the action it will perform, in both states', () => {
      const { unmount } = renderHeader({ sidebarOpen: true });
      expect(screen.getByRole('button', { name: 'Collapse navigation' })).toBeInTheDocument();
      unmount();

      renderHeader({ sidebarOpen: false });
      expect(screen.getByRole('button', { name: 'Expand navigation' })).toBeInTheDocument();
    });

    it('reports the sidebar state via aria-expanded', () => {
      const { unmount } = renderHeader({ sidebarOpen: true });
      expect(screen.getByRole('button', { name: /navigation/ })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      unmount();

      renderHeader({ sidebarOpen: false });
      expect(screen.getByRole('button', { name: /navigation/ })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    });
  });

  describe('breadcrumb', () => {
    it('shows the section and page for the current path', () => {
      pathnameRef.current = '/admin/users';
      renderHeader();

      const crumb = screen.getByLabelText('Breadcrumb');

      expect(crumb).toHaveTextContent('Administration');
      expect(crumb).toHaveTextContent('Users');
    });

    it('omits the section when it has no label', () => {
      pathnameRef.current = '/';
      renderHeader();

      const crumb = screen.getByLabelText('Breadcrumb');

      expect(crumb).toHaveTextContent('Dashboard');
      expect(crumb).not.toHaveTextContent('Administration');
    });

    it('marks the current page for assistive tech', () => {
      pathnameRef.current = '/admin/users';
      renderHeader();

      expect(screen.getByText('Users')).toHaveAttribute('aria-current', 'page');
    });

    // /sign-in has no nav entry, and the shell must not crash or render an empty
    // breadcrumb shell on a page that isn't in the nav.
    it('renders no breadcrumb at all off-nav', () => {
      pathnameRef.current = '/sign-in';
      renderHeader();

      expect(screen.queryByLabelText('Breadcrumb')).not.toBeInTheDocument();
      expect(screen.getByText('Test App')).toBeInTheDocument();
    });

    it('still resolves a breadcrumb on a nested detail page', () => {
      pathnameRef.current = '/admin/users/42';
      renderHeader();

      expect(screen.getByLabelText('Breadcrumb')).toHaveTextContent('Users');
    });
  });

  describe('actions slot', () => {
    it('renders whatever the layout passes in', () => {
      pathnameRef.current = '/';
      renderHeader({ actions: <button type="button">Run job</button> });

      expect(screen.getByRole('button', { name: 'Run job' })).toBeInTheDocument();
    });

    it('renders nothing extra when omitted', () => {
      pathnameRef.current = '/';
      renderHeader();

      expect(screen.queryByRole('button', { name: 'Run job' })).not.toBeInTheDocument();
    });
  });

  describe('user menu', () => {
    it("renders Clerk's user button", () => {
      renderHeader();

      expect(screen.getByTestId('user-button')).toBeInTheDocument();
    });

    it('derives its appearance from the MUI theme rather than hardcoding colours', () => {
      renderHeader();

      const variables = clerkProps.current?.appearance?.variables;

      expect(variables?.colorPrimary).toBe(theme.palette.primary.main);
      expect(variables?.colorText).toBe(theme.palette.text.primary);
      expect(variables?.fontFamily).toBe(theme.typography.fontFamily);
    });
  });
});
