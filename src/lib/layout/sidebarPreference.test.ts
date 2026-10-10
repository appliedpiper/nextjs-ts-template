import { describe, expect, it } from 'vitest';

import {
  SIDEBAR_COOKIE,
  SIDEBAR_DEFAULT_OPEN,
  parseSidebarPreference,
  serializeSidebarPreference,
  writeSidebarPreference,
} from './sidebarPreference';

describe('parseSidebarPreference', () => {
  it('reads the two values it writes', () => {
    expect(parseSidebarPreference('true')).toBe(true);
    expect(parseSidebarPreference('false')).toBe(false);
  });

  it('round-trips whatever serialize produces', () => {
    for (const open of [true, false]) {
      const value = serializeSidebarPreference(open).split('=')[1].split(';')[0];
      expect(parseSidebarPreference(value)).toBe(open);
    }
  });

  // A corrupt or legacy cookie must not collapse the layout or throw; the default
  // is the only safe interpretation.
  it('falls back to the default for anything unrecognised', () => {
    for (const value of [undefined, null, '', 'TRUE', 'False', '1', '0', 'yes', '{]']) {
      expect(parseSidebarPreference(value)).toBe(SIDEBAR_DEFAULT_OPEN);
    }
  });

  it('defaults to expanded', () => {
    expect(SIDEBAR_DEFAULT_OPEN).toBe(true);
    expect(parseSidebarPreference(undefined)).toBe(true);
  });
});

describe('serializeSidebarPreference', () => {
  it('scopes the cookie to the whole site so it applies on every route', () => {
    expect(serializeSidebarPreference(true)).toContain('path=/');
  });

  it('sets a long max-age so the preference does not expire mid-use', () => {
    const maxAge = Number(/max-age=(\d+)/.exec(serializeSidebarPreference(true))?.[1]);

    expect(maxAge).toBeGreaterThan(60 * 60 * 24 * 300);
  });

  it('uses SameSite=Lax', () => {
    expect(serializeSidebarPreference(false).toLowerCase()).toContain('samesite=lax');
  });

  // Secure would stop the cookie working on http://localhost, and there is nothing
  // sensitive in a sidebar width.
  it('does not set Secure, which would break local http development', () => {
    expect(serializeSidebarPreference(true).toLowerCase()).not.toContain('secure');
  });
});

describe('writeSidebarPreference', () => {
  it('writes a value the parser can read back', () => {
    writeSidebarPreference(false);

    const match = new RegExp(`${SIDEBAR_COOKIE}=([^;]*)`).exec(document.cookie);
    expect(parseSidebarPreference(match?.[1])).toBe(false);

    writeSidebarPreference(true);

    const next = new RegExp(`${SIDEBAR_COOKIE}=([^;]*)`).exec(document.cookie);
    expect(parseSidebarPreference(next?.[1])).toBe(true);
  });
});
