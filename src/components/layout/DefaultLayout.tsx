// The app's default layout, and the only auth-aware piece of the layout stack.
//
// A server component on purpose. Resolving the role here means a non-admin's
// browser never receives the admin nav entries at all, rather than receiving them
// and being asked not to render them.
//
// IMPORTANT: this is presentation, not protection. Filtering the nav hides links;
// it does not gate routes. Access control lives in `src/proxy.ts` (edge) and
// `requireRole` (resource). A route with no entry here is still reachable by URL.

import type { ReactNode } from 'react';
import { cookies } from 'next/headers';

import { APP_NAME } from '@/lib/appConfig';
import { getCurrentRole } from '@/lib/auth/requireRole';
import { SIDEBAR_COOKIE, parseSidebarPreference } from '@/lib/layout/sidebarPreference';
import { visibleNavFor } from '@/lib/navigation/navigation';

import { AppShell } from './AppShell';
import { RoleBadge } from './RoleBadge';

export interface DefaultLayoutProps {
  children: ReactNode;
  /** Overridable so a section can retitle the shell without a second layout. */
  title?: string;
}

export default async function DefaultLayout({
  children,
  title = APP_NAME,
}: DefaultLayoutProps) {
  const role = await getCurrentRole();

  // Read server-side so the sidebar renders at its stored width on the first
  // paint — no flash of the wrong state, no hydration mismatch.
  const cookieStore = await cookies();
  const defaultOpen = parseSidebarPreference(cookieStore.get(SIDEBAR_COOKIE)?.value);

  return (
    <AppShell
      title={title}
      sections={visibleNavFor(role)}
      defaultOpen={defaultOpen}
      // Where per-user header items are decided. Add role-dependent controls here
      // rather than inside AppHeader, which stays presentational.
      actions={<RoleBadge role={role} />}
    >
      {children}
    </AppShell>
  );
}
