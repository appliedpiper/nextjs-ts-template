// The result shape and operator-facing messages for a role change.
//
// Kept separate from `setRole.ts` because that file carries `'use server'`, and
// Next.js allows **only async function exports** from such a file — a constant
// or a re-exported type there fails the build with "Only async functions are
// allowed to be exported in a 'use server' file". So the action lives there and
// its vocabulary lives here, where both the action and the UI can import it.

import type { Role } from './roles';

/** Where the role table lives, revalidated so a change shows on the next render. */
export const ACCESS_PATH = '/admin/access';

export type SetRoleResult =
  | { ok: true; userId: string; role: Role }
  | { ok: false; error: string };

/**
 * Why self-changes are refused: an admin demoting their own account can leave
 * the portal with no admin at all, and nothing in the UI can undo it — recovery
 * means going back to the Clerk Dashboard. Blocking it is cheaper than counting
 * the remaining admins, and avoids the race where two admins demote each other
 * concurrently and both checks pass.
 *
 * The cost is that stepping down requires a second admin to do it for you, or
 * the Clerk Dashboard. For a single-admin portal that is the right trade.
 */
export const SELF_CHANGE_ERROR =
  'You cannot change your own role. Ask another admin, or use the Clerk Dashboard.';

export const INVALID_ROLE_ERROR = 'That is not a role this application recognises.';

export const MISSING_USER_ERROR = 'No account was specified.';

export const WRITE_FAILED_ERROR =
  'Clerk rejected the change, so the role was not updated. Try again.';
