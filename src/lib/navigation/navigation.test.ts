import { describe, expect, it } from 'vitest';

import {
  NAV_SECTIONS,
  canSeeNavItem,
  findActiveItem,
  findActiveTrail,
  isNavLink,
  isPlaceholderItem,
  matchesNavItem,
  visibleNavFor,
} from './navigation';
import type { NavIcon, NavItem, NavSection } from './types';

// Icons are only ever passed through as component references here, never
// rendered, so a stub keeps these tests free of MUI.
const Icon = (() => null) as unknown as NavIcon;

function item(overrides: Partial<NavItem> & Pick<NavItem, 'id'>): NavItem {
  return { label: overrides.id, icon: Icon, ...overrides };
}

const fixture: NavSection[] = [
  {
    id: 'open',
    items: [
      item({ id: 'home', href: '/', exact: true }),
      item({ id: 'builds', href: '/builds' }),
    ],
  },
  {
    id: 'admin-only',
    label: 'Administration',
    items: [
      item({ id: 'users', href: '/admin/users', requiredRole: 'admin' }),
      item({ id: 'user-detail', href: '/admin/users/active', requiredRole: 'admin' }),
      item({ id: 'pending', requiredRole: 'admin' }),
    ],
  },
];

function idsIn(sections: NavSection[]): string[] {
  return sections.flatMap((section) => section.items.map((i) => i.id));
}

describe('canSeeNavItem', () => {
  it('shows an item with no requiredRole to any signed-in role, including a missing claim', () => {
    const open = item({ id: 'builds', href: '/builds' });

    expect(canSeeNavItem(open, 'admin')).toBe(true);
    expect(canSeeNavItem(open, 'user')).toBe(true);
    expect(canSeeNavItem(open, undefined)).toBe(true);
  });

  it('shows an admin item only to an admin', () => {
    const adminOnly = item({ id: 'users', href: '/admin/users', requiredRole: 'admin' });

    expect(canSeeNavItem(adminOnly, 'admin')).toBe(true);
    expect(canSeeNavItem(adminOnly, 'user')).toBe(false);
  });

  // The Clerk Dashboard session claim is a manual prerequisite, so until it is
  // configured every account arrives here with an undefined role. That has to
  // hide admin entries rather than reveal them.
  it('hides an admin item when the role claim is absent', () => {
    const adminOnly = item({ id: 'users', href: '/admin/users', requiredRole: 'admin' });

    expect(canSeeNavItem(adminOnly, undefined)).toBe(false);
  });
});

describe('visibleNavFor', () => {
  it('gives an admin every item', () => {
    expect(idsIn(visibleNavFor('admin', fixture))).toEqual([
      'home',
      'builds',
      'users',
      'user-detail',
      'pending',
    ]);
  });

  it('withholds admin items from a plain user', () => {
    expect(idsIn(visibleNavFor('user', fixture))).toEqual(['home', 'builds']);
  });

  it('withholds admin items when the role is undefined', () => {
    expect(idsIn(visibleNavFor(undefined, fixture))).toEqual(['home', 'builds']);
  });

  it('drops a section whose items are all filtered out, leaving no orphan heading', () => {
    const sections = visibleNavFor('user', fixture);

    expect(sections.map((s) => s.id)).toEqual(['open']);
    expect(sections.some((s) => s.label === 'Administration')).toBe(false);
  });

  it('does not mutate the source registry', () => {
    const before = JSON.stringify(fixture.map((s) => s.items.map((i) => i.id)));
    visibleNavFor('user', fixture);

    expect(JSON.stringify(fixture.map((s) => s.items.map((i) => i.id)))).toBe(before);
  });

  it('hides the real registry Users entry from a non-admin', () => {
    expect(idsIn(visibleNavFor('admin', NAV_SECTIONS))).toContain('users');
    expect(idsIn(visibleNavFor('user', NAV_SECTIONS))).not.toContain('users');
    expect(idsIn(visibleNavFor(undefined, NAV_SECTIONS))).not.toContain('users');
  });
});

describe('placeholder items', () => {
  it('treats an item with no href as a placeholder, and one with an href as real', () => {
    expect(isPlaceholderItem(item({ id: 'pending' }))).toBe(true);
    expect(isPlaceholderItem(item({ id: 'builds', href: '/builds' }))).toBe(false);
  });

  it('still shows a placeholder in the sidebar', () => {
    expect(idsIn(visibleNavFor('admin', fixture))).toContain('pending');
  });

  it('role-filters a placeholder like any other item', () => {
    expect(idsIn(visibleNavFor('user', fixture))).not.toContain('pending');
    expect(idsIn(visibleNavFor(undefined, fixture))).not.toContain('pending');
  });

  // A placeholder has no destination, so nothing can be "inside" it. Without
  // this, an href-less item would normalize to '' and prefix-match every path.
  it('never matches any path', () => {
    const pending = item({ id: 'pending' });

    for (const path of ['/', '/builds', '/admin/users', '/anything/at/all', '']) {
      expect(matchesNavItem(path, pending)).toBe(false);
    }
  });

  it('is never resolved as the active item', () => {
    const onlyPlaceholders: NavSection[] = [
      { id: 's', items: [item({ id: 'a' }), item({ id: 'b' })] },
    ];

    expect(findActiveItem('/', onlyPlaceholders)).toBeUndefined();
    expect(findActiveItem('/admin/users', onlyPlaceholders)).toBeUndefined();
  });

  it('does not shadow a real item that does match', () => {
    expect(findActiveItem('/admin/users', fixture)?.id).toBe('users');
  });

  it('keeps Settings as a placeholder in the real registry', () => {
    const settings = NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.id === 'settings');

    expect(settings).toBeDefined();
    expect(isPlaceholderItem(settings as NavItem)).toBe(true);
  });
});

describe('matchesNavItem', () => {
  it('matches a subtree so a detail page still highlights its parent', () => {
    const users = item({ id: 'users', href: '/admin/users' });

    expect(matchesNavItem('/admin/users', users)).toBe(true);
    expect(matchesNavItem('/admin/users/123', users)).toBe(true);
    expect(matchesNavItem('/admin/users/123/edit', users)).toBe(true);
  });

  // Segment-aware: a plain startsWith would wrongly light up Users here.
  it('does not match a sibling path that merely shares a prefix', () => {
    const users = item({ id: 'users', href: '/admin/users' });

    expect(matchesNavItem('/admin/users-archive', users)).toBe(false);
    expect(matchesNavItem('/admin/usersomething', users)).toBe(false);
  });

  it('treats a root href as exact so it does not match every path', () => {
    const home = item({ id: 'home', href: '/', exact: true });

    expect(matchesNavItem('/', home)).toBe(true);
    expect(matchesNavItem('/admin/users', home)).toBe(false);
    expect(matchesNavItem('/builds', home)).toBe(false);
  });

  it('treats a root href as exact even without the exact flag', () => {
    const home = item({ id: 'home', href: '/' });

    expect(matchesNavItem('/admin/users', home)).toBe(false);
  });

  it('honours exact on a non-root href', () => {
    const exactBuilds = item({ id: 'builds', href: '/builds', exact: true });

    expect(matchesNavItem('/builds', exactBuilds)).toBe(true);
    expect(matchesNavItem('/builds/42', exactBuilds)).toBe(false);
  });

  it('ignores a trailing slash on either side', () => {
    expect(matchesNavItem('/admin/users/', item({ id: 'users', href: '/admin/users' }))).toBe(true);
    expect(matchesNavItem('/admin/users', item({ id: 'users', href: '/admin/users/' }))).toBe(true);
    expect(matchesNavItem('/', item({ id: 'home', href: '/', exact: true }))).toBe(true);
  });

  it('does not match an unrelated path', () => {
    expect(matchesNavItem('/settings', item({ id: 'users', href: '/admin/users' }))).toBe(false);
  });
});

describe('findActiveItem', () => {
  it('picks the deepest match when an ancestor also matches', () => {
    expect(findActiveItem('/admin/users/active', fixture)?.id).toBe('user-detail');
    expect(findActiveItem('/admin/users/active/42', fixture)?.id).toBe('user-detail');
  });

  it('falls back to the ancestor when the deeper item does not match', () => {
    expect(findActiveItem('/admin/users/999', fixture)?.id).toBe('users');
  });

  it('resolves the root path to the root item rather than a longer one', () => {
    expect(findActiveItem('/', fixture)?.id).toBe('home');
  });

  it('returns undefined for a page that is not in the nav at all', () => {
    expect(findActiveItem('/sign-in', fixture)).toBeUndefined();
    expect(findActiveItem('/nope', fixture)).toBeUndefined();
  });

  it('searches the real registry', () => {
    expect(findActiveItem('/admin/users', NAV_SECTIONS)?.label).toBe('Users');
    expect(findActiveItem('/', NAV_SECTIONS)?.label).toBe('Dashboard');
  });
});

describe('findActiveTrail', () => {
  it('returns the matching item together with its section', () => {
    const trail = findActiveTrail('/admin/users', fixture);

    expect(trail?.item.id).toBe('users');
    expect(trail?.section.id).toBe('admin-only');
    expect(trail?.section.label).toBe('Administration');
  });

  it('reports the section even when it has no label', () => {
    const trail = findActiveTrail('/builds', fixture);

    expect(trail?.section.id).toBe('open');
    expect(trail?.section.label).toBeUndefined();
  });

  it('agrees with findActiveItem, which is built on it', () => {
    for (const path of ['/', '/builds', '/admin/users', '/admin/users/active', '/nope']) {
      expect(findActiveTrail(path, fixture)?.item).toBe(findActiveItem(path, fixture));
    }
  });

  it('returns undefined off-nav', () => {
    expect(findActiveTrail('/sign-in', fixture)).toBeUndefined();
  });
});

describe('isNavLink', () => {
  it('narrows a real item and rejects a placeholder', () => {
    expect(isNavLink(item({ id: 'builds', href: '/builds' }))).toBe(true);
    expect(isNavLink(item({ id: 'pending' }))).toBe(false);
  });

  it('is the exact inverse of isPlaceholderItem', () => {
    for (const candidate of [item({ id: 'a', href: '/a' }), item({ id: 'b' })]) {
      expect(isNavLink(candidate)).toBe(!isPlaceholderItem(candidate));
    }
  });
});
