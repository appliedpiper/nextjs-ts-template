// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  getUserList: vi.fn(),
  updateUserMetadata: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({
  clerkClient: vi.fn(async () => ({
    users: {
      getUserList: hoisted.getUserList,
      updateUserMetadata: hoisted.updateUserMetadata,
    },
  })),
}));

import {
  listUsers,
  primaryEmailOf,
  roleFromMetadata,
  setUserRole,
  toManagedUser,
  USER_PAGE_LIMIT,
} from './users';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('roleFromMetadata', () => {
  it('reads a valid role straight off publicMetadata', () => {
    expect(roleFromMetadata({ role: 'admin' })).toBe('admin');
    expect(roleFromMetadata({ role: 'user' })).toBe('user');
  });

  it('returns undefined for absent metadata', () => {
    expect(roleFromMetadata(null)).toBeUndefined();
    expect(roleFromMetadata(undefined)).toBeUndefined();
    // The shape of every hand-created Clerk account: publicMetadata is `{}`.
    expect(roleFromMetadata({})).toBeUndefined();
  });

  it('fails closed on an unrecognised value rather than trusting it', () => {
    expect(roleFromMetadata({ role: 'superadmin' })).toBeUndefined();
    expect(roleFromMetadata({ role: 'Admin' })).toBeUndefined();
    expect(roleFromMetadata({ role: '' })).toBeUndefined();
    expect(roleFromMetadata({ role: 42 })).toBeUndefined();
    expect(roleFromMetadata({ role: { nested: true } })).toBeUndefined();
  });

  it('does not read the nested session-claim shape', () => {
    // `getRole` in roles.ts takes { metadata: { role } }; this one must not,
    // or the two would silently accept each other's input.
    expect(roleFromMetadata({ metadata: { role: 'admin' } })).toBeUndefined();
  });
});

describe('primaryEmailOf', () => {
  it('prefers the address Clerk marks as primary', () => {
    const email = primaryEmailOf({
      id: 'u_1',
      primaryEmailAddressId: 'e_2',
      emailAddresses: [
        { id: 'e_1', emailAddress: 'old@example.com' },
        { id: 'e_2', emailAddress: 'primary@example.com' },
      ],
    });

    expect(email).toBe('primary@example.com');
  });

  it('falls back to the first address when no primary is designated', () => {
    expect(
      primaryEmailOf({
        id: 'u_1',
        primaryEmailAddressId: null,
        emailAddresses: [{ id: 'e_1', emailAddress: 'only@example.com' }],
      }),
    ).toBe('only@example.com');
  });

  it('falls back to the first address when the primary id matches nothing', () => {
    // Guards against returning undefined if Clerk's ids ever disagree.
    expect(
      primaryEmailOf({
        id: 'u_1',
        primaryEmailAddressId: 'e_missing',
        emailAddresses: [{ id: 'e_1', emailAddress: 'first@example.com' }],
      }),
    ).toBe('first@example.com');
  });

  it('returns an empty string when there are no addresses at all', () => {
    expect(primaryEmailOf({ id: 'u_1', emailAddresses: [] })).toBe('');
    expect(primaryEmailOf({ id: 'u_1' })).toBe('');
  });
});

describe('toManagedUser', () => {
  it('flattens a fully populated account', () => {
    expect(
      toManagedUser({
        id: 'u_1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        primaryEmailAddressId: 'e_1',
        emailAddresses: [{ id: 'e_1', emailAddress: 'ada@example.com' }],
        publicMetadata: { role: 'admin' },
      }),
    ).toEqual({
      id: 'u_1',
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      role: 'admin',
    });
  });

  it('uses the email as the name when no name is set', () => {
    const row = toManagedUser({
      id: 'u_2',
      firstName: null,
      lastName: null,
      emailAddresses: [{ id: 'e_1', emailAddress: 'nameless@example.com' }],
      publicMetadata: {},
    });

    expect(row.name).toBe('nameless@example.com');
    expect(row.role).toBeUndefined();
  });

  it('copes with only one half of the name present', () => {
    expect(toManagedUser({ id: 'u_3', firstName: 'Grace', lastName: null }).name).toBe('Grace');
    expect(toManagedUser({ id: 'u_4', firstName: null, lastName: 'Hopper' }).name).toBe('Hopper');
  });

  it('leaves the name empty when there is neither a name nor an email', () => {
    expect(toManagedUser({ id: 'u_5' }).name).toBe('');
  });
});

describe('listUsers', () => {
  it('requests a full page rather than Clerk’s default of ten', async () => {
    hoisted.getUserList.mockResolvedValue({ data: [], totalCount: 0 });

    await listUsers();

    expect(hoisted.getUserList).toHaveBeenCalledWith({
      limit: USER_PAGE_LIMIT,
      orderBy: '-created_at',
    });
  });

  it('maps the accounts Clerk returns', async () => {
    hoisted.getUserList.mockResolvedValue({
      data: [
        {
          id: 'u_1',
          firstName: 'Ada',
          lastName: 'Lovelace',
          primaryEmailAddressId: 'e_1',
          emailAddresses: [{ id: 'e_1', emailAddress: 'ada@example.com' }],
          publicMetadata: { role: 'admin' },
        },
      ],
      totalCount: 1,
    });

    const result = await listUsers();

    expect(result.users).toEqual([
      { id: 'u_1', email: 'ada@example.com', name: 'Ada Lovelace', role: 'admin' },
    ]);
    expect(result.totalCount).toBe(1);
    expect(result.truncated).toBe(false);
  });

  it('flags a directory larger than one page as truncated', async () => {
    hoisted.getUserList.mockResolvedValue({
      data: [{ id: 'u_1' }],
      totalCount: 900,
    });

    const result = await listUsers();

    expect(result.users).toHaveLength(1);
    expect(result.totalCount).toBe(900);
    expect(result.truncated).toBe(true);
  });

  it('handles an empty directory without reporting truncation', async () => {
    hoisted.getUserList.mockResolvedValue({ data: [], totalCount: 0 });

    const result = await listUsers();

    expect(result.users).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  it('lets a Clerk failure propagate instead of pretending the list is empty', async () => {
    hoisted.getUserList.mockRejectedValue(new Error('clerk unreachable'));

    await expect(listUsers()).rejects.toThrow('clerk unreachable');
  });
});

describe('setUserRole', () => {
  it('writes the role into publicMetadata', async () => {
    hoisted.updateUserMetadata.mockResolvedValue({});

    await setUserRole('u_1', 'admin');

    expect(hoisted.updateUserMetadata).toHaveBeenCalledWith('u_1', {
      publicMetadata: { role: 'admin' },
    });
  });

  it('writes only the role key, so unrelated metadata survives Clerk’s patch', async () => {
    hoisted.updateUserMetadata.mockResolvedValue({});

    await setUserRole('u_1', 'user');

    const [, payload] = hoisted.updateUserMetadata.mock.calls[0];
    expect(Object.keys(payload)).toEqual(['publicMetadata']);
    expect(Object.keys(payload.publicMetadata)).toEqual(['role']);
  });

  it('lets a Clerk failure propagate so the caller can report it', async () => {
    hoisted.updateUserMetadata.mockRejectedValue(new Error('user not found'));

    await expect(setUserRole('u_missing', 'user')).rejects.toThrow('user not found');
  });
});
