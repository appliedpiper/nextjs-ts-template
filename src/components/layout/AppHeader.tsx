'use client';

// The top bar: sidebar toggle, app identity, a breadcrumb for where you are, a
// caller-supplied actions slot, and the Clerk user menu.
//
// Like AppSidebar this is presentational — it takes the already-filtered nav and
// whatever actions the server layout decided this user should see, and renders
// them. It makes no authorization decisions of its own.

import { UserButton } from '@clerk/nextjs';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { clerkAppearanceVariables } from '@/lib/clerkAppearance';
import { findActiveTrail } from '@/lib/navigation/navigation';
import type { NavSection } from '@/lib/navigation/types';

export interface AppHeaderProps {
  /** Product name, shown left of the breadcrumb. */
  title: string;
  /** Already role-filtered; used only to resolve the breadcrumb. */
  sections: NavSection[];
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  /**
   * Right-aligned slot, before the user menu. This is where per-user or per-page
   * header items go — the server layout decides what belongs here.
   */
  actions?: ReactNode;
}

export function AppHeader({
  title,
  sections,
  sidebarOpen,
  onToggleSidebar,
  actions,
}: AppHeaderProps) {
  const theme = useTheme();
  // Read here rather than threaded from the shell, matching AppSidebar — each
  // piece of chrome stays self-contained and independently testable.
  const pathname = usePathname();
  const trail = findActiveTrail(pathname ?? '/', sections);
  const toggleLabel = sidebarOpen ? 'Collapse navigation' : 'Expand navigation';

  return (
    <AppBar
      position="fixed"
      elevation={0}
      // Flat, bordered, and surface-coloured rather than MUI's default primary
      // fill — reads as tooling chrome rather than a consumer app bar.
      sx={{
        zIndex: (t) => t.zIndex.drawer + 1,
        bgcolor: 'background.paper',
        color: 'text.primary',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Toolbar variant="dense" sx={{ gap: 1 }}>
        <Tooltip title={toggleLabel}>
          <IconButton
            edge="start"
            size="small"
            onClick={onToggleSidebar}
            aria-label={toggleLabel}
            aria-expanded={sidebarOpen}
            sx={{ mr: 0.5 }}
          >
            {sidebarOpen ? <MenuOpenIcon /> : <MenuIcon />}
          </IconButton>
        </Tooltip>

        <Typography variant="subtitle1" component="div" noWrap sx={{ fontWeight: 600 }}>
          {title}
        </Typography>

        {/* Breadcrumb is supplementary to the title, so it is the first thing
            dropped on a narrow viewport. */}
        {trail && (
          <Breadcrumbs
            separator="/"
            aria-label="Breadcrumb"
            sx={{
              display: { xs: 'none', sm: 'flex' },
              ml: 1,
              color: 'text.secondary',
              '& .MuiBreadcrumbs-separator': { mx: 1 },
            }}
          >
            {trail.section.label ? (
              <Typography key="section" variant="body2" color="text.secondary">
                {trail.section.label}
              </Typography>
            ) : null}
            <Typography key="page" variant="body2" color="text.primary" aria-current="page">
              {trail.item.label}
            </Typography>
          </Breadcrumbs>
        )}

        <Box sx={{ flexGrow: 1 }} />

        {actions}

        <UserButton
          appearance={{ variables: clerkAppearanceVariables(theme) }}
          userProfileMode="modal"
        />
      </Toolbar>
    </AppBar>
  );
}

export default AppHeader;
