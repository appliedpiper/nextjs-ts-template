// Shared sidebar geometry. Lives in its own module because both AppSidebar (to
// lay out its rows) and AppShell (to size the Drawer and offset the main column)
// need the same numbers, and they must not drift apart.

export const SIDEBAR_WIDTH = 248;

/** Wide enough for a centred 24px icon plus comfortable touch padding. */
export const SIDEBAR_COLLAPSED_WIDTH = 72;

export function sidebarWidth(open: boolean): number {
  return open ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED_WIDTH;
}
