// Persistence for the sidebar's expanded/collapsed preference.
//
// A cookie rather than localStorage, so the *server* can read it and render the
// correct width on the first paint. localStorage is only readable after mount,
// which forces either a hydration mismatch or a visible snap from expanded to
// collapsed on every page load.
//
// This is a per-browser UI preference, not data: it is non-sensitive, and losing
// it is harmless.

export const SIDEBAR_COOKIE = 'sidebar_open';

/** A year — a UI preference shouldn't quietly expire mid-use. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Expanded unless the cookie explicitly says otherwise. */
export const SIDEBAR_DEFAULT_OPEN = true;

/**
 * Parses the cookie value. Anything unrecognised — absent, empty, legacy, or
 * corrupt — falls back to the default rather than guessing.
 */
export function parseSidebarPreference(value: string | undefined | null): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return SIDEBAR_DEFAULT_OPEN;
}

export function serializeSidebarPreference(open: boolean): string {
  // SameSite=Lax is enough: this is a display preference, so there is nothing to
  // protect against CSRF. No Secure flag, or it would stop working on http://localhost.
  return `${SIDEBAR_COOKIE}=${String(open)}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax`;
}

/** Client-side write. No-ops outside the browser instead of throwing. */
export function writeSidebarPreference(open: boolean): void {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = serializeSidebarPreference(open);
  } catch {
    // A failed write costs a preference, never the layout.
  }
}
