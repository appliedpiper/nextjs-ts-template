// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { getRole, hasRole, isAdmin, isRole, satisfiesRole } from './roles';

describe('getRole', () => {
  it('reads a valid role out of the session claims', () => {
    expect(getRole({ metadata: { role: 'admin' } })).toBe('admin');
    expect(getRole({ metadata: { role: 'user' } })).toBe('user');
  });

  it('returns undefined when the claims are absent', () => {
    expect(getRole(null)).toBeUndefined();
    expect(getRole(undefined)).toBeUndefined();
  });

  it('returns undefined when metadata is missing or empty', () => {
    // This is the shape when the Clerk Dashboard session claim isn't configured.
    expect(getRole({})).toBeUndefined();
    expect(getRole({ metadata: null })).toBeUndefined();
    expect(getRole({ metadata: {} })).toBeUndefined();
  });

  it('rejects an unrecognised role string rather than trusting it', () => {
    expect(getRole({ metadata: { role: 'superadmin' } })).toBeUndefined();
    expect(getRole({ metadata: { role: 'Admin' } })).toBeUndefined();
    expect(getRole({ metadata: { role: '' } })).toBeUndefined();
  });

  it('rejects non-string role values', () => {
    expect(getRole({ metadata: { role: 1 } })).toBeUndefined();
    expect(getRole({ metadata: { role: true } })).toBeUndefined();
    expect(getRole({ metadata: { role: ['admin'] } })).toBeUndefined();
    expect(getRole({ metadata: { role: { name: 'admin' } } })).toBeUndefined();
  });
});

describe('isRole', () => {
  it('accepts only the two known roles', () => {
    expect(isRole('admin')).toBe(true);
    expect(isRole('user')).toBe(true);
    expect(isRole('moderator')).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isRole(null)).toBe(false);
  });
});

describe('hasRole and isAdmin', () => {
  it('compares against the parsed role', () => {
    expect(hasRole({ metadata: { role: 'admin' } }, 'admin')).toBe(true);
    expect(hasRole({ metadata: { role: 'user' } }, 'admin')).toBe(false);
    expect(hasRole(null, 'user')).toBe(false);
  });

  it('identifies admins', () => {
    expect(isAdmin({ metadata: { role: 'admin' } })).toBe(true);
    expect(isAdmin({ metadata: { role: 'user' } })).toBe(false);
    expect(isAdmin({})).toBe(false);
  });
});

describe('satisfiesRole', () => {
  it('treats any signed-in user as satisfying the user role', () => {
    expect(satisfiesRole('user', 'user')).toBe(true);
    expect(satisfiesRole('admin', 'user')).toBe(true);
    expect(satisfiesRole(undefined, 'user')).toBe(true);
  });

  it('requires the admin role explicitly', () => {
    expect(satisfiesRole('admin', 'admin')).toBe(true);
    expect(satisfiesRole('user', 'admin')).toBe(false);
    expect(satisfiesRole(undefined, 'admin')).toBe(false);
  });
});
