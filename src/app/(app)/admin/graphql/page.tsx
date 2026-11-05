// An admin-only GraphQL IDE, hosted on this origin so no token handling is
// needed: the browser already has the Clerk session cookie, `/api/graphql`
// turns it into a Bearer token, and the backend verifies that as usual.
//
// Why `/admin/graphql` rather than a GET handler on the API route: everything
// under `/admin` is already admin-gated by `isAdminPath` in `lib/auth/access.ts`
// (enforced by `proxy.ts`) and by `requireRole('admin')` in the admin layout.
// Putting the IDE here reuses those gates instead of adding a new one.
//
// The admin gate is not decoration. Reads are NOT scoped per customer — any
// verified session can query every user and order — so an IDE available to all
// signed-in accounts would hand every customer a tool for browsing every other
// customer's records. See `backend/docs/auth.md` ("Known gaps").

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { GraphqlSandbox } from '@/components/graphql/GraphqlSandbox';
import { requireRole } from '@/lib/auth/requireRole';

// Belt and braces with the admin layout's identical call. `requireRole`
// redirects by throwing, so nothing below runs for a non-admin.
export default async function Page() {
  await requireRole('admin');

  // Apollo disables introspection when NODE_ENV=production, so the IDE would
  // load with no schema, no docs and no autocomplete — worse than not offering
  // it. Refuse plainly instead of shipping something half-working.
  const isProduction = process.env.NODE_ENV === 'production';

  return (
    <Stack spacing={2} sx={{ height: '100%' }}>
      <div>
        <Typography variant="h5" component="h1">
          GraphQL
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Query the API as yourself. Requests go through <code>/api/graphql</code>,
          which attaches your Clerk session token — there is no token to copy and
          nothing to refresh.
        </Typography>
      </div>

      {isProduction ? (
        <Alert severity="info">
          The GraphQL IDE is disabled in production. Apollo turns off schema
          introspection when <code>NODE_ENV=production</code>, so the IDE would
          load without a schema, docs, or autocomplete.
        </Alert>
      ) : (
        <GraphqlSandbox />
      )}
    </Stack>
  );
}
