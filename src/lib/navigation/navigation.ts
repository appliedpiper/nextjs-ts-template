// The application's navigation registry, plus pure helpers for filtering it by
// role and resolving which item is active.
//
// The helpers are pure functions with no Clerk, Next, or rendering dependencies,
// so they unit-test directly in the spirit of `lib/auth/access.ts`. Each one
// takes the sections as a parameter (defaulting to the registry) so tests can
// drive them with fixtures. The registry references icon *components*, never JSX,
// which keeps this importable from a server component.
//
// A server component resolves the role and hands the filtered result to the
// client shell as props.

import { satisfiesRole, type Role } from '@/lib/auth/roles';

import type { NavIcon, NavItem, NavSection } from './types';

import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';

/**
 * Stand-in icon for an item whose page doesn't exist yet. Deliberately neutral
 * so a placeholder reads as unfinished rather than as a real feature; swap it for
 * a meaningful icon when the route is built.
 */
export const PLACEHOLDER_ICON: NavIcon = CircleOutlinedIcon;

/**
 * A real, navigable item. Written as a type guard so a renderer that branches on
 * it gets `href` narrowed to `string`, rather than needing a non-null assertion
 * or a bogus fallback href.
 */
export function isNavLink(item: NavItem): item is NavItem & { href: string } {
  return Boolean(item.href);
}

/**
 * An item with no `href` — shown, but disabled and never active. Defined as the
 * exact inverse of `isNavLink` so the two can't drift.
 */
export function isPlaceholderItem(item: NavItem): boolean {
  return !isNavLink(item);
}

/**
 * Every nav item in the app, in display order, before role filtering.
 *
 * Items with an `href` are real links. Items without one are placeholders: they
 * occupy their slot in the sidebar but render disabled, so the shape of the app
 * is visible without any entry dead-ending in a 404.
 *
 * To promote a placeholder, give it an `href` and a real icon:
 *
 *     - { id: 'settings', label: 'Settings', icon: PLACEHOLDER_ICON }
 *     + { id: 'settings', label: 'Settings', href: '/admin/settings',
 *     +   icon: SettingsIcon }
 *
 * `requiredRole` controls *visibility only*. The route still has to be gated by
 * `src/proxy.ts` / `requireRole` — see `docs/layout.md`.
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    id: 'overview',
    items: [
      {
        // `exact` matters here: without it, href '/' prefix-matches every path
        // in the app and Dashboard would always look active.
        id: 'dashboard',
        label: 'Dashboard',
        href: '/',
        icon: DashboardIcon,
        exact: true,
      },
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    items: [
      {
        id: 'users',
        label: 'Users',
        href: '/admin/users',
        icon: PeopleIcon,
        requiredRole: 'admin',
      },
      // Carried over from the layout this replaced, which had a Settings entry
      // that also went nowhere. No href, so it is disabled rather than a 404.
      {
        id: 'settings',
        label: 'Settings',
        icon: PLACEHOLDER_ICON,
        requiredRole: 'admin',
      },
    ],
  },
];

/** Strips a trailing slash so '/admin/users/' and '/admin/users' compare equal. */
function normalize(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.replace(/\/+$/, '') || '/';
  }
  return pathname;
}

export function canSeeNavItem(item: NavItem, role: Role | undefined): boolean {
  // No requiredRole means "any signed-in user". `satisfiesRole(role, 'user')` is
  // true for a signed-in account even when the role claim is missing, which is
  // the documented behaviour for non-admin routes.
  return satisfiesRole(role, item.requiredRole ?? 'user');
}

/**
 * The sections a user with `role` should see. Sections left with no visible
 * items are dropped entirely, so a filtered-out group doesn't leave an orphan
 * subheader behind.
 *
 * An unrecognised or absent role resolves to `undefined` upstream (`getRole`),
 * which means admin items are hidden — failing closed.
 */
export function visibleNavFor(
  role: Role | undefined,
  sections: readonly NavSection[] = NAV_SECTIONS,
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canSeeNavItem(item, role)),
    }))
    .filter((section) => section.items.length > 0);
}

/**
 * Whether `pathname` falls under `item`. Segment-aware, so '/admin/users' does
 * not match '/admin/users-archive'; subtree matching means a detail page like
 * '/admin/users/123' still highlights its parent nav entry.
 */
export function matchesNavItem(pathname: string, item: NavItem): boolean {
  // A placeholder has no destination, so no path can be "inside" it.
  if (!item.href) return false;

  const path = normalize(pathname);
  const href = normalize(item.href);

  if (item.exact || href === '/') {
    return path === href;
  }

  return path === href || path.startsWith(`${href}/`);
}

/** The active item together with the section it belongs to. */
export interface NavTrail {
  section: NavSection;
  item: NavItem;
}

/**
 * The deepest matching item plus its section, so a header can render a breadcrumb
 * without searching the nav a second time. A nested entry wins over an ancestor
 * that also matches. Returns undefined when nothing matches — the shell has to
 * cope with being on a page that isn't in the nav at all.
 */
export function findActiveTrail(
  pathname: string,
  sections: readonly NavSection[] = NAV_SECTIONS,
): NavTrail | undefined {
  let best: NavTrail | undefined;
  let bestDepth = -1;

  for (const section of sections) {
    for (const item of section.items) {
      if (!matchesNavItem(pathname, item)) continue;

      const depth = item.href ? normalize(item.href).length : -1;
      if (depth > bestDepth) {
        best = { section, item };
        bestDepth = depth;
      }
    }
  }

  return best;
}

/** As `findActiveTrail`, when only the item matters. */
export function findActiveItem(
  pathname: string,
  sections: readonly NavSection[] = NAV_SECTIONS,
): NavItem | undefined {
  return findActiveTrail(pathname, sections)?.item;
}
