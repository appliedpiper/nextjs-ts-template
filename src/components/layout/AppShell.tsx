'use client';

// The application chrome: header, sidebar, and the main content column.
//
// Owns the only mutable layout state (whether the sidebar is expanded, and whether
// the mobile drawer is showing). Everything it renders is presentational and
// already role-filtered by the server layout above it.

import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Toolbar from '@mui/material/Toolbar';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import {
  SIDEBAR_DEFAULT_OPEN,
  writeSidebarPreference,
} from '@/lib/layout/sidebarPreference';
import type { NavSection } from '@/lib/navigation/types';

import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import { SIDEBAR_WIDTH, sidebarWidth } from './dimensions';

/** Toggles the sidebar. Chosen to match the convention in editors and IDEs. */
export const SIDEBAR_TOGGLE_KEY = '[';

export interface AppShellProps {
  title: string;
  /** Already filtered by role — the shell does no authorization. */
  sections: NavSection[];
  /** Header items for this user, decided by the server layout. */
  actions?: ReactNode;
  /**
   * Initial sidebar state, read from the cookie by the server layout. Passed in
   * rather than discovered here so the first paint is already correct — no
   * hydration mismatch and no visible snap from expanded to collapsed.
   */
  defaultOpen?: boolean;
  children: ReactNode;
}

function isTypingInto(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

export function AppShell({
  title,
  sections,
  actions,
  defaultOpen = SIDEBAR_DEFAULT_OPEN,
  children,
}: AppShellProps) {
  const theme = useTheme();

  // Server and client both start from the cookie-derived value, so this agrees
  // across hydration with no effect needed to correct it.
  const [open, setOpen] = useState(defaultOpen);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Only used by event handlers, never to decide what to render, so its
  // first-render value being wrong cannot cause a hydration mismatch.
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const toggleSidebar = useCallback(() => {
    // On a narrow viewport the control opens the overlay instead of collapsing
    // the rail, and that choice isn't persisted — it's transient, not a preference.
    if (!isDesktop) {
      setMobileOpen(!mobileOpen);
      return;
    }

    const next = !open;
    setOpen(next);
    // Side effect in an event handler, deliberately not in the state updater,
    // which React may invoke more than once.
    writeSidebarPreference(next);
  }, [isDesktop, open, mobileOpen]);

  // Kept in a ref so the key listener is attached once rather than re-bound every
  // time the toggle identity changes. Synced in an effect, not during render.
  const toggleRef = useRef(toggleSidebar);

  useEffect(() => {
    toggleRef.current = toggleSidebar;
  }, [toggleSidebar]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== SIDEBAR_TOGGLE_KEY) return;
      // Leave modified combinations to the browser, and never steal a keystroke
      // from someone filling in a field.
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingInto(event.target)) return;

      event.preventDefault();
      toggleRef.current();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh', bgcolor: 'background.default' }}>
      <AppHeader
        title={title}
        sections={sections}
        sidebarOpen={isDesktop ? open : mobileOpen}
        onToggleSidebar={toggleSidebar}
        actions={actions}
      />

      {/* Desktop rail. Hidden by CSS rather than unmounted, so resizing doesn't
          throw away the sidebar and no media query is needed during render. */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: sidebarWidth(open),
          flexShrink: 0,
          whiteSpace: 'nowrap',
          '& .MuiDrawer-paper': {
            width: sidebarWidth(open),
            overflowX: 'hidden',
            bgcolor: 'background.paper',
            borderRight: 1,
            borderColor: 'divider',
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
          },
        }}
      >
        <Toolbar variant="dense" />
        <AppSidebar sections={sections} open={open} />
      </Drawer>

      {/* Mobile overlay. Deliberately not `keepMounted`: closed, it renders
          nothing, so there is only ever one sidebar in the DOM at a time. */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={closeMobile}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: SIDEBAR_WIDTH },
        }}
      >
        <Toolbar variant="dense" />
        {/* Always expanded here — an overlay has room for labels. */}
        <AppSidebar sections={sections} open onNavigate={closeMobile} />
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          // Without this a wide child (a table, a log pane) forces the whole
          // layout wider instead of scrolling inside the content column.
          minWidth: 0,
          p: 3,
        }}
      >
        {/* Matches the dense AppBar's height; a default Toolbar would mis-offset. */}
        <Toolbar variant="dense" />
        {children}
      </Box>
    </Box>
  );
}

export default AppShell;
