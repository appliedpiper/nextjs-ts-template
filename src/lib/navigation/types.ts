// Shape of the application's navigation, independent of how it's rendered.
//
// Deliberately free of React element types: `icon` is a *component reference*,
// not JSX, so this module and the registry that uses it stay importable from
// server components without dragging a client boundary along.

import type { SvgIconProps } from '@mui/material/SvgIcon';
import type { ComponentType } from 'react';

import type { Role } from '@/lib/auth/roles';

export type NavIcon = ComponentType<SvgIconProps>;

export interface NavItem {
  /** Stable identifier, used as a React key and in tests. */
  id: string;
  label: string;
  /**
   * Absolute app path, and what active-state matching compares against.
   *
   * **Omit it to declare a placeholder** — an item whose page doesn't exist yet.
   * Placeholders render disabled and non-navigable instead of linking to a 404,
   * and never resolve as the active item. Give it an `href` once the route is
   * built and it becomes a normal link with no other change.
   */
  href?: string;
  icon: NavIcon;
  /**
   * Minimum role needed to *see* this item. Omitted means "any signed-in user".
   *
   * Visibility only. Access is enforced by `src/proxy.ts` and `requireRole`;
   * omitting this does not make a route public, and setting it does not protect
   * one.
   */
  requiredRole?: Role;
  /**
   * When true, the item is active only on an exact path match rather than on
   * its whole subtree. Needed for a root-level `/` entry, which would otherwise
   * prefix-match every path in the app.
   */
  exact?: boolean;
}

export interface NavSection {
  id: string;
  /**
   * Shown as a subheader above the group when the sidebar is expanded. Omit for
   * a leading group that needs no heading.
   */
  label?: string;
  items: NavItem[];
}
