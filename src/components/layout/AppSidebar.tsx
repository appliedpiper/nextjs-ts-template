'use client';

// The sidebar's *contents* only — AppShell owns the Drawer and its width, so this
// component stays independently testable and reusable inside either Drawer
// variant (permanent on desktop, temporary on mobile).

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { findActiveItem, isNavLink } from '@/lib/navigation/navigation';
import type { NavItem, NavSection } from '@/lib/navigation/types';

export interface AppSidebarProps {
  /** Already filtered by role — this component does no authorization itself. */
  sections: NavSection[];
  /** False renders the icon-only rail. */
  open: boolean;
  /** Called after a real navigation, so the mobile Drawer can close itself. */
  onNavigate?: () => void;
}

const ROW_HEIGHT = 40;

function rowWrapperSx(open: boolean) {
  return { px: open ? 1 : 0.5, py: 0.25 };
}

function NavRow({
  item,
  open,
  active,
  onNavigate,
}: {
  item: NavItem;
  open: boolean;
  active: boolean;
  onNavigate?: () => void;
}) {
  const link = isNavLink(item);
  const Icon = item.icon;

  const content = (
    <>
      <ListItemIcon
        sx={{
          minWidth: 0,
          mr: open ? 2 : 0,
          justifyContent: 'center',
          color: 'inherit',
        }}
      >
        <Icon fontSize="small" />
      </ListItemIcon>
      {open && (
        <ListItemText
          primary={item.label}
          slotProps={{
            primary: {
              variant: 'body2',
              noWrap: true,
              fontWeight: active ? 600 : 400,
            },
          }}
        />
      )}
    </>
  );

  const rowSx = {
    minHeight: ROW_HEIGHT,
    justifyContent: open ? 'flex-start' : 'center',
    px: open ? 2 : 0,
    borderRadius: 1,
    // Reserve the accent gutter on every row so text doesn't shift by 2px when
    // selection moves between rows.
    borderLeft: 2,
    borderLeftColor: active ? 'primary.main' : 'transparent',
  } as const;

  // Collapsed, the visible label is gone, so the row needs an explicit
  // accessible name. Tooltip alone is not enough: it puts aria-label on whatever
  // element it wraps, which can be a layout span rather than the link itself,
  // leaving the link unnamed for assistive tech.
  const ariaLabel = open ? undefined : item.label;

  const row = isNavLink(item) ? (
    <ListItemButton
      component={Link}
      href={item.href}
      selected={active}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      aria-label={ariaLabel}
      sx={rowSx}
    >
      {content}
    </ListItemButton>
  ) : (
    // No `component={Link}` and no href: a placeholder must not navigate.
    // ButtonBase's `disabled` also sets tabIndex -1 and aria-disabled, so it
    // leaves the tab order rather than just looking greyed out.
    <ListItemButton disabled aria-label={ariaLabel} sx={rowSx}>
      {content}
    </ListItemButton>
  );

  // Collapsed to the rail, the label is the only thing identifying a row, so it
  // has to be reachable on hover. Expanded, the visible text already says it.
  const needsTooltip = !open || !link;
  const tooltip = link ? item.label : `${item.label} — not available yet`;

  if (!needsTooltip) {
    return <ListItem disablePadding sx={rowWrapperSx(open)}>{row}</ListItem>;
  }

  return (
    <ListItem disablePadding sx={rowWrapperSx(open)}>
      <Tooltip title={tooltip} placement="right" disableInteractive>
        {link ? (
          row
        ) : (
          // A disabled ButtonBase swallows pointer events, so the span gives
          // Tooltip something that still reports hover.
          <Box component="span" sx={{ display: 'flex', width: '100%' }}>
            {row}
          </Box>
        )}
      </Tooltip>
    </ListItem>
  );
}

export function AppSidebar({ sections, open, onNavigate }: AppSidebarProps) {
  const pathname = usePathname();
  // Resolving one active id up front means only the deepest match highlights,
  // rather than every ancestor that also matches the path.
  const activeId = findActiveItem(pathname ?? '/', sections)?.id;

  return (
    <Box
      component="nav"
      aria-label="Main navigation"
      sx={{ flexGrow: 1, overflowX: 'hidden', overflowY: 'auto', py: 1 }}
    >
      {sections.map((section) => (
        <List
          key={section.id}
          dense
          disablePadding
          aria-label={section.label}
          sx={{ mb: 1 }}
        >
          {/* Collapsed, a text heading would just clip — the gap between lists
              carries the grouping instead. */}
          {open && section.label && (
            <Typography
              variant="overline"
              component="div"
              sx={{
                px: 3,
                pt: 1,
                pb: 0.5,
                display: 'block',
                color: 'text.secondary',
                letterSpacing: '0.08em',
                lineHeight: 1.6,
              }}
            >
              {section.label}
            </Typography>
          )}

          {section.items.map((item) => (
            <NavRow
              key={item.id}
              item={item}
              open={open}
              active={item.id === activeId}
              onNavigate={onNavigate}
            />
          ))}
        </List>
      ))}
    </Box>
  );
}

export default AppSidebar;
