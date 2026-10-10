import { ThemeProvider } from '@mui/material/styles';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SIDEBAR_COOKIE } from '@/lib/layout/sidebarPreference';
import type { NavIcon, NavItem, NavSection } from '@/lib/navigation/types';
import { theme } from '@/lib/theme';

const { pathnameRef } = vi.hoisted(() => ({ pathnameRef: { current: '/' } }));

vi.mock('next/navigation', () => ({ usePathname: () => pathnameRef.current }));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@clerk/nextjs', () => ({
  UserButton: () => <div data-testid="user-button" />,
}));

import { AppShell } from './AppShell';
import { SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_WIDTH } from './dimensions';

const Icon = (() => null) as unknown as NavIcon;

function item(overrides: Partial<NavItem> & Pick<NavItem, 'id'>): NavItem {
  return { label: overrides.id, icon: Icon, ...overrides };
}

const sections: NavSection[] = [
  { id: 'overview', items: [item({ id: 'Dashboard', href: '/', exact: true })] },
  {
    id: 'administration',
    label: 'Administration',
    items: [item({ id: 'Users', href: '/admin/users' })],
  },
];

/**
 * MUI reads layout breakpoints through matchMedia, which jsdom does not
 * implement. Without this every test would run as the mobile branch.
 */
function setViewport(kind: 'desktop' | 'mobile') {
  window.matchMedia = ((query: string) => ({
    // breakpoints.up('md') compiles to a min-width query.
    matches: kind === 'desktop' && query.includes('min-width'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function renderShell(props: Partial<React.ComponentProps<typeof AppShell>> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <AppShell title="Test App" sections={sections} {...props}>
        <p>Page body</p>
      </AppShell>
    </ThemeProvider>,
  );
}

/**
 * The desktop rail's paper element, whose width reflects collapsed state. MUI
 * marks the permanent variant's root `docked` (not `permanent`) — verified against
 * `drawerClasses` rather than guessed.
 */
function railPaper(container: HTMLElement): HTMLElement {
  const paper = container.querySelector('.MuiDrawer-docked .MuiDrawer-paper');
  if (!paper) throw new Error('permanent drawer paper not found');
  return paper as HTMLElement;
}

beforeEach(() => {
  setViewport('desktop');
  pathnameRef.current = '/';
  document.cookie = `${SIDEBAR_COOKIE}=; path=/; max-age=0`;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AppShell', () => {
  it('renders the page content, the header, and the nav together', () => {
    const { container } = renderShell();

    expect(screen.getByText('Page body')).toBeInTheDocument();
    expect(screen.getByText('Test App')).toBeInTheDocument();
    expect(within(railPaper(container)).getByRole('link', { name: 'Users' })).toBeInTheDocument();
  });

  it('puts the page content in a main landmark', () => {
    renderShell();

    expect(within(screen.getByRole('main')).getByText('Page body')).toBeInTheDocument();
  });

  it('renders only one sidebar at a time, so links are not duplicated', () => {
    renderShell();

    expect(screen.getAllByRole('link', { name: 'Users' })).toHaveLength(1);
  });

  describe('collapsing on desktop', () => {
    it('starts expanded by default', () => {
      const { container } = renderShell();

      expect(railPaper(container)).toHaveStyle({ width: `${SIDEBAR_WIDTH}px` });
      expect(within(railPaper(container)).getByText('Users')).toBeInTheDocument();
    });

    it('collapses to the rail when toggled, hiding labels', () => {
      const { container } = renderShell();

      fireEvent.click(screen.getByRole('button', { name: 'Collapse navigation' }));

      expect(railPaper(container)).toHaveStyle({ width: `${SIDEBAR_COLLAPSED_WIDTH}px` });
      expect(within(railPaper(container)).queryByText('Users')).not.toBeInTheDocument();
      // Still reachable — the row keeps an accessible name via its tooltip.
      expect(within(railPaper(container)).getByRole('link', { name: 'Users' })).toBeInTheDocument();
    });

    it('expands again on a second toggle', () => {
      const { container } = renderShell();

      fireEvent.click(screen.getByRole('button', { name: 'Collapse navigation' }));
      fireEvent.click(screen.getByRole('button', { name: 'Expand navigation' }));

      expect(railPaper(container)).toHaveStyle({ width: `${SIDEBAR_WIDTH}px` });
    });
  });

  describe('persistence', () => {
    // The server reads the cookie and passes defaultOpen, so honouring the prop is
    // what makes the preference survive a reload.
    it('honours a collapsed defaultOpen from the server', () => {
      const { container } = renderShell({ defaultOpen: false });

      expect(railPaper(container)).toHaveStyle({ width: `${SIDEBAR_COLLAPSED_WIDTH}px` });
      expect(screen.getByRole('button', { name: 'Expand navigation' })).toBeInTheDocument();
    });

    it('writes the new state to the cookie when collapsed', () => {
      renderShell();

      fireEvent.click(screen.getByRole('button', { name: 'Collapse navigation' }));

      expect(document.cookie).toContain(`${SIDEBAR_COOKIE}=false`);
    });

    it('writes the new state to the cookie when expanded again', () => {
      renderShell({ defaultOpen: false });

      fireEvent.click(screen.getByRole('button', { name: 'Expand navigation' }));

      expect(document.cookie).toContain(`${SIDEBAR_COOKIE}=true`);
    });
  });

  describe('keyboard shortcut', () => {
    it('toggles the sidebar on "["', () => {
      const { container } = renderShell();

      fireEvent.keyDown(window, { key: '[' });

      expect(railPaper(container)).toHaveStyle({ width: `${SIDEBAR_COLLAPSED_WIDTH}px` });
    });

    it('ignores modified combinations, which belong to the browser', () => {
      const { container } = renderShell();

      fireEvent.keyDown(window, { key: '[', metaKey: true });
      fireEvent.keyDown(window, { key: '[', ctrlKey: true });
      fireEvent.keyDown(window, { key: '[', altKey: true });

      expect(railPaper(container)).toHaveStyle({ width: `${SIDEBAR_WIDTH}px` });
    });

    // Otherwise typing "[" into a search box or a JSON field collapses the layout.
    it('does not steal the key while typing into a field', () => {
      const { container } = renderShell();
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      fireEvent.keyDown(input, { key: '[' });

      expect(railPaper(container)).toHaveStyle({ width: `${SIDEBAR_WIDTH}px` });
      input.remove();
    });

    it('ignores other keys', () => {
      const { container } = renderShell();

      fireEvent.keyDown(window, { key: ']' });
      fireEvent.keyDown(window, { key: 'a' });

      expect(railPaper(container)).toHaveStyle({ width: `${SIDEBAR_WIDTH}px` });
    });

    it('stops listening once unmounted', () => {
      const { container, unmount } = renderShell();
      unmount();

      // Would throw if the handler were still attached to a torn-down tree.
      fireEvent.keyDown(window, { key: '[' });

      expect(container).toBeEmptyDOMElement();
    });
  });

  // Caveat for anyone extending these: jsdom does not evaluate @media queries, so
  // the desktop rail is still in the DOM here even though a real browser hides it
  // at this width. These assertions are therefore scoped to the overlay (MUI's
  // Modal root, role="presentation") rather than the whole document, and the CSS
  // display rules themselves are NOT covered by this suite.
  describe('mobile overlay', () => {
    beforeEach(() => setViewport('mobile'));

    function overlay() {
      return screen.getByRole('presentation');
    }

    it('keeps the overlay closed initially', () => {
      renderShell();

      expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
    });

    it('opens the overlay when toggled instead of collapsing the rail', () => {
      const { container } = renderShell();

      fireEvent.click(screen.getByRole('button', { name: 'Expand navigation' }));

      expect(overlay()).toBeInTheDocument();
      expect(within(overlay()).getByRole('link', { name: 'Users' })).toBeInTheDocument();
      // The rail is untouched — the overlay is a separate surface, not a resize.
      expect(railPaper(container)).toHaveStyle({ width: `${SIDEBAR_WIDTH}px` });
    });

    it('shows labels in the overlay, which has room for them', () => {
      renderShell();

      fireEvent.click(screen.getByRole('button', { name: 'Expand navigation' }));

      expect(within(overlay()).getByText('Users')).toBeInTheDocument();
    });

    it('closes itself after a navigation', () => {
      renderShell();
      fireEvent.click(screen.getByRole('button', { name: 'Expand navigation' }));

      fireEvent.click(within(overlay()).getByRole('link', { name: 'Users' }));

      expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
    });

    it('does not persist the transient overlay state to the cookie', () => {
      renderShell();

      fireEvent.click(screen.getByRole('button', { name: 'Expand navigation' }));

      expect(document.cookie).not.toContain(`${SIDEBAR_COOKIE}=`);
    });
  });
});
