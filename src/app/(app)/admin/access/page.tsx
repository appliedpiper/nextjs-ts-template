// Role management for Clerk accounts.
//
// These are *Clerk accounts*, which hold roles in their public metadata. The
// MongoDB records at `/admin/customers` are a separate, unrelated set of people
// with no Clerk id and no role — see `docs/auth-component-flow.md`.
//
// The `requireRole` call here guards the *page*. It is not what protects the
// change itself: `setRole` is a public POST endpoint and re-checks
// authorization server-side on every call.

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AccessTable } from '@/components/access/AccessTable';
import { requireRole } from '@/lib/auth/requireRole';
import { listUsers } from '@/lib/auth/users';

export default async function Page() {
  const { userId } = await requireRole('admin');
  const { users, totalCount, truncated } = await listUsers();

  return (
    <Stack spacing={2}>
      <div>
        <Typography variant="h5" component="h1">
          Access
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Who can sign in to this portal, and what they can do. Admins see the
          Administration section; everyone else sees only the dashboard.
        </Typography>
      </div>

      <AccessTable
        users={users}
        currentUserId={userId}
        truncated={truncated}
        totalCount={totalCount}
      />
    </Stack>
  );
}
