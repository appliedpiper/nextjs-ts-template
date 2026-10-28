import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({ setRole: vi.fn() }));

vi.mock('@/lib/auth/setRole', () => ({ setRole: hoisted.setRole }));

import { AccessTable } from './AccessTable';
import { ROLES } from '@/lib/auth/roles';
import type { ManagedUser } from '@/lib/auth/users';

const ME = 'user_me';

const me: ManagedUser = {
  id: ME,
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  role: 'admin',
};

const colleague: ManagedUser = {
  id: 'user_colleague',
  name: 'Grace Hopper',
  email: 'grace@example.com',
  role: 'user',
};

const roleless: ManagedUser = {
  id: 'user_new',
  name: 'new@example.com',
  email: 'new@example.com',
  role: undefined,
};

function renderTable(props: Partial<React.ComponentProps<typeof AccessTable>> = {}) {
  return render(<AccessTable users={[me, colleague]} currentUserId={ME} {...props} />);
}

/** The Select in the row whose name cell reads `name`. */
function roleSelect(name: string) {
  return within(screen.getByRole('row', { name: new RegExp(name) })).getByRole('combobox');
}

/**
 * Opens a MUI Select — `mouseDown` is the event it listens for. Uses
 * `fireEvent` rather than `@testing-library/user-event`, which is not a
 * dependency of this project.
 */
function openRole(name: string) {
  fireEvent.mouseDown(roleSelect(name));
}

/** Opens the Select for `name` and picks `role` from the listbox. */
function chooseRole(name: string, role: string) {
  openRole(name);
  fireEvent.click(screen.getByRole('option', { name: role }));
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.setRole.mockResolvedValue({ ok: true, userId: colleague.id, role: 'admin' });
});

describe('rendering', () => {
  it('lists every account with its current role', () => {
    renderTable();

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('grace@example.com')).toBeInTheDocument();
    expect(roleSelect('Grace Hopper')).toHaveTextContent('user');
  });

  it('says so plainly when Clerk returns nothing', () => {
    render(<AccessTable users={[]} currentUserId={ME} />);

    expect(screen.getByText('No accounts found in Clerk.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows an account with no recognised role as "no role"', () => {
    render(<AccessTable users={[roleless]} currentUserId={ME} />);

    expect(roleSelect('new@example.com')).toHaveTextContent('no role');
  });

  it('keeps a spinner slot mounted for every row, hidden until it saves', () => {
    // Mounting the spinner on demand would insert a node at exactly the moment
    // `revalidatePath` replaces this subtree. It stays mounted and toggles
    // visibility instead, so it must be unlabelled while idle.
    renderTable();

    expect(screen.queryByLabelText('Saving')).not.toBeInTheDocument();
    expect(document.querySelectorAll('[role="progressbar"]')).toHaveLength(2);
  });

  it('warns when the directory outran one Clerk page', () => {
    renderTable({ truncated: true, totalCount: 900 });

    expect(screen.getByText(/Showing 2 of 900 accounts/)).toBeInTheDocument();
  });

  it('stays quiet about pagination when the list is complete', () => {
    renderTable({ truncated: false, totalCount: 2 });

    expect(screen.queryByText(/does not paginate/)).not.toBeInTheDocument();
  });

  it('warns that a change is not visible to the other person immediately', () => {
    renderTable();

    expect(screen.getByText(/next token refresh/)).toBeInTheDocument();
  });
});

describe('the self-change guard', () => {
  it('disables the signed-in admin’s own role control', () => {
    renderTable();

    expect(roleSelect('Ada Lovelace')).toHaveAttribute('aria-disabled', 'true');
  });

  it('leaves every other row editable', () => {
    renderTable();

    expect(roleSelect('Grace Hopper')).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('matches the id exactly, not by prefix', () => {
    // `user_me_2` must stay editable even though `user_me` is a prefix of it.
    const lookalike: ManagedUser = { ...colleague, id: `${ME}_2`, name: 'Look Alike' };
    render(<AccessTable users={[me, lookalike]} currentUserId={ME} />);

    expect(roleSelect('Look Alike')).not.toHaveAttribute('aria-disabled', 'true');
  });
});

describe('changing a role', () => {
  it('sends the new role for the right account', async () => {
    renderTable();

    chooseRole('Grace Hopper', 'admin');

    await waitFor(() => {
      expect(hoisted.setRole).toHaveBeenCalledWith({ userId: colleague.id, role: 'admin' });
    });
  });

  it('confirms the change in place', async () => {
    renderTable();

    chooseRole('Grace Hopper', 'admin');

    expect(await screen.findByText(/Grace Hopper is now admin\./)).toBeInTheDocument();
    // The confirmation has to say the change isn't immediate for the other
    // person, or a hidden nav entry reads as a failure.
    expect(screen.getByRole('status')).toHaveTextContent(/token refresh/);
  });

  it('never offers "no role" as a choice', () => {
    render(<AccessTable users={[roleless]} currentUserId={ME} />);

    openRole('new@example.com');

    // "no role" is a rendered value, not an option — there is nothing to pick.
    expect(screen.queryByRole('option', { name: 'no role' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([...ROLES]);
  });

  it('offers the same options whether or not a role is already set', () => {
    // The Select's children must not vary by row state: a changing child list
    // is what makes re-rendering during the post-action refresh unsafe.
    const { unmount } = render(<AccessTable users={[roleless]} currentUserId={ME} />);
    openRole('new@example.com');
    const withoutRole = screen.getAllByRole('option').map((o) => o.textContent);
    unmount();

    render(<AccessTable users={[colleague]} currentUserId={ME} />);
    openRole('Grace Hopper');
    const withRole = screen.getAllByRole('option').map((o) => o.textContent);

    expect(withoutRole).toEqual(withRole);
  });
});

describe('when the action refuses', () => {
  it('surfaces the server’s reason rather than claiming success', async () => {
    hoisted.setRole.mockResolvedValue({ ok: false, error: 'You cannot change your own role.' });
    renderTable();

    chooseRole('Grace Hopper', 'admin');

    expect(await screen.findByText('You cannot change your own role.')).toBeInTheDocument();
    expect(screen.queryByText(/is now admin/)).not.toBeInTheDocument();
  });

  it('reports a thrown action without leaving the row spinning', async () => {
    hoisted.setRole.mockRejectedValue(new Error('connection lost'));
    renderTable();

    chooseRole('Grace Hopper', 'admin');

    expect(await screen.findByText(/could not be sent/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByLabelText('Saving')).not.toBeInTheDocument();
    });
    // The control must be usable again so the change can be retried.
    expect(roleSelect('Grace Hopper')).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('does not leak Clerk’s raw message, which the action already replaced', async () => {
    hoisted.setRole.mockResolvedValue({
      ok: false,
      error: 'Clerk rejected the change, so the role was not updated. Try again.',
    });
    renderTable();

    chooseRole('Grace Hopper', 'admin');

    expect(await screen.findByText(/Clerk rejected the change/)).toBeInTheDocument();
  });
});
