'use client';

// The role table's interactive half. Receives already-loaded rows and does no
// data fetching and no authorization of its own — the page resolves both, and
// `setRole` re-checks authorization server-side on every call.
//
// Changing a Select fires the action immediately rather than collecting edits
// behind a Save button: one field per row, and a row-level pending state reads
// more honestly than a form that might partially apply.
//
// ## Why this component keeps its DOM shape constant
//
// `setRole` calls `revalidatePath`, so the moment it resolves, Next replaces
// this page's server-rendered subtree *while* the handler's `setState` calls
// are landing. If a node is inserted or removed in that same tick, WebKit can
// throw `NotFoundError: The object can not be found here` from `insertBefore`,
// because React is holding a parent node the refresh has already swapped out.
//
// So nothing here mounts or unmounts in response to an action: the Select's
// children are a fixed list, the row spinner is always present and toggles
// `visibility`, and the message area is a permanently mounted region whose
// text changes. Add new feedback by changing content, not by conditionally
// rendering an element.

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState } from 'react';

import { setRole } from '@/lib/auth/setRole';
import { isRole, ROLES, type Role } from '@/lib/auth/roles';
import type { ManagedUser } from '@/lib/auth/users';

const SELF_TOOLTIP =
  'You cannot change your own role. Ask another admin, or use the Clerk Dashboard.';

/**
 * An account whose metadata holds no recognised role shows as "no role" via
 * `renderValue`, rather than as an extra `MenuItem`. Keeping the Select's
 * children identical on every render is what makes it safe to re-render during
 * the post-action refresh — see the note at the top of this file. `''` is also
 * rejected by `isRole`, so it cannot be submitted even if it were selected.
 *
 * Such an account can already reach every non-admin route —
 * `satisfiesRole(undefined, 'user')` is true — so this marks unset metadata,
 * not a lockout.
 */
const NO_ROLE_VALUE = '';

type Feedback = { kind: 'error' | 'success'; message: string } | null;

export interface AccessTableProps {
  users: ManagedUser[];
  /** The signed-in admin, whose own row is locked. */
  currentUserId: string;
  /** True when the directory outran one Clerk page. */
  truncated?: boolean;
  totalCount?: number;
}

export function AccessTable({ users, currentUserId, truncated, totalCount }: AccessTableProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  // A plain async handler rather than `useTransition`. Pending state is tracked
  // per row anyway, and a transition only adds another concurrent update to
  // interleave with the refresh `revalidatePath` triggers.
  async function handleChange(user: ManagedUser, next: Role) {
    setFeedback(null);
    setPendingId(user.id);

    try {
      const result = await setRole({ userId: user.id, role: next });

      if (result.ok) {
        setFeedback({
          kind: 'success',
          message: `${user.name || user.email} is now ${result.role}. They will see the change after their next token refresh — up to a minute, or immediately if they reload.`,
        });
      } else {
        setFeedback({ kind: 'error', message: result.error });
      }
    } catch {
      // A rejected action means the request never completed — a dropped
      // connection, or Next refusing it. Either way the role is unchanged,
      // and the row must not be left spinning.
      setFeedback({
        kind: 'error',
        message: 'The change could not be sent. Check your connection and try again.',
      });
    } finally {
      setPendingId(null);
    }
  }

  if (users.length === 0) {
    return <Alert severity="info">No accounts found in Clerk.</Alert>;
  }

  return (
    <Box>
      {/*
        Always mounted, so feedback never inserts a node during the refresh.
        `role="status"` makes the change announced rather than silent.
      */}
      <Box
        role="status"
        aria-live="polite"
        sx={{ minHeight: feedback ? 'auto' : 0, mb: feedback ? 2 : 0 }}
      >
        {feedback ? <Alert severity={feedback.kind}>{feedback.message}</Alert> : null}
      </Box>

      {truncated ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Showing {users.length} of {totalCount} accounts. This page does not paginate yet.
        </Alert>
      ) : null}

      <TableContainer>
        <Table size="small" aria-label="Clerk accounts and their roles">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell sx={{ width: 200 }}>Role</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              const isPending = pendingId === user.id;

              return (
                <TableRow key={user.id} hover>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Tooltip title={isSelf ? SELF_TOOLTIP : ''}>
                        {/* Spanned so the tooltip still fires over a disabled control. */}
                        <span style={{ flex: 1 }}>
                          <Select<Role | typeof NO_ROLE_VALUE>
                            size="small"
                            fullWidth
                            displayEmpty
                            // Disabled while its own request is in flight, so a
                            // second change can't race the first.
                            disabled={isSelf || isPending}
                            value={user.role ?? NO_ROLE_VALUE}
                            renderValue={(value) =>
                              value === NO_ROLE_VALUE ? 'no role' : value
                            }
                            onChange={(event) => {
                              // Guarded rather than cast: no option carries the
                              // empty value, so this only ever sees a real role,
                              // and a cast would hide it if that changed.
                              const next = event.target.value;
                              if (isRole(next)) {
                                void handleChange(user, next);
                              }
                            }}
                            inputProps={{ 'aria-label': `Role for ${user.name || user.email}` }}
                          >
                            {/* Fixed list — see the note at the top of this file. */}
                            {ROLES.map((role) => (
                              <MenuItem key={role} value={role}>
                                {role}
                              </MenuItem>
                            ))}
                          </Select>
                        </span>
                      </Tooltip>
                      {/*
                        Always rendered and toggled with `visibility`, so the
                        spinner never inserts or removes a node mid-refresh.
                        It also reserves its own width, so no row reflows.
                        The label exists only while pending, so assistive tech
                        and tests see "Saving" only when something is saving.
                      */}
                      <CircularProgress
                        size={16}
                        aria-label={isPending ? 'Saving' : undefined}
                        aria-hidden={!isPending}
                        sx={{ visibility: isPending ? 'visible' : 'hidden', flexShrink: 0 }}
                      />
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
        A role change reaches the other person on their next token refresh — up to a
        minute. Their sidebar is rendered by the app layout, so they need to{' '}
        <strong>reload the page</strong> (or sign out and back in) before a new
        Administration entry appears.
      </Typography>
    </Box>
  );
}

export default AccessTable;
