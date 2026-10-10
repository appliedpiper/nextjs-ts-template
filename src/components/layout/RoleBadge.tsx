import Chip from '@mui/material/Chip';

import type { Role } from '@/lib/auth/roles';

/**
 * Shows the signed-in user's role in the header — a concrete example of a header
 * item that varies per user, and useful context in a tool where what you can do
 * depends on who you are.
 *
 * An absent role is rendered as an explicit warning rather than hidden. It means
 * the Clerk Dashboard session claim isn't configured, which silently hides every
 * admin nav entry; surfacing it turns a confusing empty sidebar into a visible
 * cause. See `docs/auth.md`.
 */
export function RoleBadge({ role }: { role: Role | undefined }) {
  const missing = role === undefined;

  return (
    <Chip
      size="small"
      variant="outlined"
      color={missing ? 'warning' : 'default'}
      label={missing ? 'no role' : role}
      title={
        missing
          ? 'No role in the session token — admin navigation is hidden. Configure the Clerk session claim.'
          : `Signed in as ${role}`
      }
      // Supplementary, so it is dropped before the breadcrumb on narrow screens.
      sx={{ display: { xs: 'none', sm: 'inline-flex' }, textTransform: 'lowercase' }}
    />
  );
}

export default RoleBadge;
