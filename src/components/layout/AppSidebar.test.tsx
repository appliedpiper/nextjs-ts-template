// fireEvent rather than user-event: the latter isn't installed and adding a
// dependency needs sign-off per CLAUDE.md. Clicks are all this file needs.
import { fireEvent, render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { NavIcon, NavItem, NavSection } from '@/lib/navigation/types';

import { AppSidebar } from './AppSidebar';

// usePathname drives active state; a ref keeps it settable per test without
// re-mocking the module each time.
const { pathnameRef } = vi.hoisted(() => ({ pathnameRef: { current: '/' } }));

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameRef.current,
}));

// next/link needs App Router context it won't have in jsdom, and the thing under
// test is which href we hand it, not its own behaviour.
vi.mock('next/link', () => ({
  default: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

const Icon = (() => null) as unknown as NavIcon;

function item(overrides: Partial<NavItem> & Pick<NavItem, 'id'>): NavItem {
  return { label: overrides.id, icon: Icon, ...overrides };
}

const sections: NavSection[] = [
  {
    id: 'overview',
    items: [item({ id: 'Dashboard', href: '/', exact: true })],
  },
  {
    id: 'administration',
    label: 'Administration',
    items: [
      item({ id: 'Users', href: '/admin/users' }),
      item({ id: 'Builds', href: '/admin/users/builds' }),
      item({ id: 'Settings' }),
    ],
  },
];

function renderSidebar(props: { open?: boolean; onNavigate?: () => void } = {}) {
  return render(<AppSidebar sections={sections} open={props.open ?? true} {...props} />);
}

describe('AppSidebar', () => {
  it('renders a navigation landmark', () => {
    renderSidebar();

    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });

  it('renders one row per item in the sections it is given', () => {
    renderSidebar();

    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Users' })).toBeInTheDocument();
  });

  // It does no filtering of its own — DefaultLayout hands it a pre-filtered list.
  it('renders exactly the sections passed in, adding nothing', () => {
    render(
      <AppSidebar sections={[{ id: 'only', items: [item({ id: 'Solo', href: '/solo' })] }]} open />,
    );

    expect(screen.getByRole('link', { name: 'Solo' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
  });

  describe('real links', () => {
    it('links each item to its href', () => {
      renderSidebar();

      expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/admin/users');
      expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/');
    });

    it('calls onNavigate when followed, so the mobile drawer can close', () => {
      const onNavigate = vi.fn();
      renderSidebar({ onNavigate });

      fireEvent.click(screen.getByRole('link', { name: 'Users' }));

      expect(onNavigate).toHaveBeenCalledTimes(1);
    });
  });

  describe('placeholders', () => {
    it('does not render a placeholder as a link', () => {
      renderSidebar();

      expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    });

    it('marks it disabled and removes it from the tab order', () => {
      renderSidebar();
      const settings = screen.getByRole('button', { name: 'Settings' });

      expect(settings).toHaveAttribute('aria-disabled', 'true');
      expect(settings).toHaveAttribute('tabindex', '-1');
    });

    it('has no href at all, so there is nothing to 404 on', () => {
      renderSidebar();

      expect(screen.getByRole('button', { name: 'Settings' })).not.toHaveAttribute('href');
    });

    it('cannot trigger navigation', () => {
      const onNavigate = vi.fn();
      renderSidebar({ onNavigate });

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

      expect(onNavigate).not.toHaveBeenCalled();
    });

    it('is never marked as the current page', () => {
      pathnameRef.current = '/';
      renderSidebar();

      expect(screen.getByRole('button', { name: 'Settings' })).not.toHaveAttribute('aria-current');
    });
  });

  describe('active state', () => {
    it('marks the matching item as the current page', () => {
      pathnameRef.current = '/admin/users';
      renderSidebar();

      expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('aria-current', 'page');
    });

    it('marks only one item, the deepest match, rather than every ancestor', () => {
      pathnameRef.current = '/admin/users/builds';
      renderSidebar();

      expect(screen.getByRole('link', { name: 'Builds' })).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('link', { name: 'Users' })).not.toHaveAttribute('aria-current');
      expect(screen.getAllByRole('link').filter((el) => el.hasAttribute('aria-current'))).toHaveLength(1);
    });

    it('keeps a detail page highlighting its parent entry', () => {
      pathnameRef.current = '/admin/users/42';
      renderSidebar();

      expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('aria-current', 'page');
    });

    it('does not mark the root item active on a nested page', () => {
      pathnameRef.current = '/admin/users';
      renderSidebar();

      expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
    });

    it('marks nothing when the page is not in the nav', () => {
      pathnameRef.current = '/sign-in';
      renderSidebar();

      expect(screen.getAllByRole('link').filter((el) => el.hasAttribute('aria-current'))).toHaveLength(0);
    });
  });

  describe('collapsed rail', () => {
    it('hides item labels and the section heading', () => {
      pathnameRef.current = '/';
      renderSidebar({ open: false });

      expect(screen.queryByText('Users')).not.toBeInTheDocument();
      expect(screen.queryByText('Administration')).not.toBeInTheDocument();
    });

    it('still renders every row, so nothing becomes unreachable', () => {
      renderSidebar({ open: false });

      // Labels are gone from the page, but each row keeps an accessible name via
      // its tooltip so the rail stays navigable.
      expect(screen.getByRole('link', { name: 'Users' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    });

    it('shows the section heading again when expanded', () => {
      renderSidebar({ open: true });

      expect(screen.getByText('Administration')).toBeInTheDocument();
    });
  });
});
