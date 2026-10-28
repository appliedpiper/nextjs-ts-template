// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  requireRole: vi.fn(),
  setUserRole: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('./requireRole', () => ({ requireRole: hoisted.requireRole }));
vi.mock('./users', () => ({ setUserRole: hoisted.setUserRole }));
vi.mock('next/cache', () => ({ revalidatePath: hoisted.revalidatePath }));

import {
  ACCESS_PATH,
  INVALID_ROLE_ERROR,
  MISSING_USER_ERROR,
  SELF_CHANGE_ERROR,
  WRITE_FAILED_ERROR,
} from './roleChange';
import { setRole } from './setRole';

const ADMIN = 'user_admin';

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.requireRole.mockResolvedValue({ userId: ADMIN, role: 'admin' });
  hoisted.setUserRole.mockResolvedValue(undefined);
});

describe('authorization', () => {
  it('demands the admin role before anything else happens', async () => {
    await setRole({ userId: 'user_other', role: 'admin' });

    expect(hoisted.requireRole).toHaveBeenCalledWith('admin');
  });

  it('writes nothing when requireRole redirects a non-admin away', async () => {
    // `requireRole` signals refusal by calling redirect(), which throws.
    const redirect = new Error('NEXT_REDIRECT');
    hoisted.requireRole.mockRejectedValue(redirect);

    await expect(setRole({ userId: 'user_other', role: 'admin' })).rejects.toThrow('NEXT_REDIRECT');

    expect(hoisted.setUserRole).not.toHaveBeenCalled();
    expect(hoisted.revalidatePath).not.toHaveBeenCalled();
  });

  it('lets the redirect propagate rather than returning a result object', async () => {
    // Regression guard: wrapping requireRole in the try/catch would swallow
    // NEXT_REDIRECT and let an unauthorized request carry on.
    hoisted.requireRole.mockRejectedValue(new Error('NEXT_REDIRECT'));

    await expect(setRole({ userId: 'user_other', role: 'user' })).rejects.toThrow();
  });

  it('checks authorization before validating the arguments', async () => {
    // An unauthorized caller must not be able to tell a valid payload from an
    // invalid one, so the redirect has to win over the validation error.
    hoisted.requireRole.mockRejectedValue(new Error('NEXT_REDIRECT'));

    await expect(
      setRole({ userId: '', role: 'nonsense' as unknown as 'admin' }),
    ).rejects.toThrow('NEXT_REDIRECT');
  });
});

describe('the happy path', () => {
  it('promotes another account and reports what changed', async () => {
    const result = await setRole({ userId: 'user_other', role: 'admin' });

    expect(result).toEqual({ ok: true, userId: 'user_other', role: 'admin' });
    expect(hoisted.setUserRole).toHaveBeenCalledWith('user_other', 'admin');
  });

  it('demotes another account just as readily', async () => {
    const result = await setRole({ userId: 'user_other', role: 'user' });

    expect(result).toEqual({ ok: true, userId: 'user_other', role: 'user' });
    expect(hoisted.setUserRole).toHaveBeenCalledWith('user_other', 'user');
  });

  it('revalidates the access page so the new role renders', async () => {
    await setRole({ userId: 'user_other', role: 'admin' });

    expect(hoisted.revalidatePath).toHaveBeenCalledWith(ACCESS_PATH);
    expect(ACCESS_PATH).toBe('/admin/access');
  });
});

describe('the self-change guard', () => {
  it('refuses to let an admin demote themselves', async () => {
    const result = await setRole({ userId: ADMIN, role: 'user' });

    expect(result).toEqual({ ok: false, error: SELF_CHANGE_ERROR });
    expect(hoisted.setUserRole).not.toHaveBeenCalled();
    expect(hoisted.revalidatePath).not.toHaveBeenCalled();
  });

  it('refuses even a no-op self-change, so the rule is simple to reason about', async () => {
    const result = await setRole({ userId: ADMIN, role: 'admin' });

    expect(result).toEqual({ ok: false, error: SELF_CHANGE_ERROR });
    expect(hoisted.setUserRole).not.toHaveBeenCalled();
  });

  it('still allows changing an account that merely looks similar', async () => {
    // Guards against a prefix or case-insensitive comparison creeping in.
    const result = await setRole({ userId: `${ADMIN}_2`, role: 'user' });

    expect(result.ok).toBe(true);
    expect(hoisted.setUserRole).toHaveBeenCalledWith(`${ADMIN}_2`, 'user');
  });
});

describe('input validation', () => {
  it('rejects a role the app does not recognise', async () => {
    for (const role of ['superadmin', 'Admin', '', 'owner']) {
      const result = await setRole({ userId: 'user_other', role: role as unknown as 'admin' });
      expect(result).toEqual({ ok: false, error: INVALID_ROLE_ERROR });
    }

    expect(hoisted.setUserRole).not.toHaveBeenCalled();
  });

  it('rejects a non-string role, which the declared types do not prevent', async () => {
    for (const role of [42, null, undefined, { role: 'admin' }, ['admin']]) {
      const result = await setRole({ userId: 'user_other', role: role as unknown as 'admin' });
      expect(result).toEqual({ ok: false, error: INVALID_ROLE_ERROR });
    }

    expect(hoisted.setUserRole).not.toHaveBeenCalled();
  });

  it('rejects a missing or non-string user id', async () => {
    for (const userId of ['', null, undefined, 7, {}]) {
      const result = await setRole({ userId: userId as unknown as string, role: 'admin' });
      expect(result).toEqual({ ok: false, error: MISSING_USER_ERROR });
    }

    expect(hoisted.setUserRole).not.toHaveBeenCalled();
  });

  it('survives a missing payload entirely', async () => {
    const result = await setRole(undefined as unknown as { userId: string; role: 'admin' });

    expect(result).toEqual({ ok: false, error: MISSING_USER_ERROR });
    expect(hoisted.setUserRole).not.toHaveBeenCalled();
  });
});

describe('when Clerk fails', () => {
  it('reports a generic failure instead of leaking Clerk’s message', async () => {
    hoisted.setUserRole.mockRejectedValue(new Error('Clerk: user_abc123 not found'));

    const result = await setRole({ userId: 'user_missing', role: 'admin' });

    expect(result).toEqual({ ok: false, error: WRITE_FAILED_ERROR });
    expect(JSON.stringify(result)).not.toContain('user_abc123');
  });

  it('does not revalidate when the write failed, since nothing changed', async () => {
    hoisted.setUserRole.mockRejectedValue(new Error('network'));

    await setRole({ userId: 'user_other', role: 'admin' });

    expect(hoisted.revalidatePath).not.toHaveBeenCalled();
  });
});
