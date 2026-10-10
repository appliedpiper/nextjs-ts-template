import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RoleBadge } from './RoleBadge';

describe('RoleBadge', () => {
  it('names the role for an admin', () => {
    render(<RoleBadge role="admin" />);

    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('names the role for a plain user', () => {
    render(<RoleBadge role="user" />);

    expect(screen.getByText('user')).toBeInTheDocument();
  });

  // A missing role is the state the app is in until the Clerk Dashboard session
  // claim is configured, and it silently hides every admin nav entry. Showing it
  // turns a confusing empty sidebar into a visible cause.
  describe('missing role', () => {
    it('says so explicitly instead of rendering nothing', () => {
      render(<RoleBadge role={undefined} />);

      expect(screen.getByText('no role')).toBeInTheDocument();
    });

    it('explains the consequence in its title', () => {
      const { container } = render(<RoleBadge role={undefined} />);

      expect(container.querySelector('[title]')?.getAttribute('title')).toMatch(
        /admin navigation is hidden/i,
      );
    });

    it('is styled as a warning, not as ordinary chrome', () => {
      const { container: missing } = render(<RoleBadge role={undefined} />);
      const warningChip = missing.querySelector('.MuiChip-colorWarning');

      expect(warningChip).toBeInTheDocument();
    });

    it('does not warn when a role is present', () => {
      const { container } = render(<RoleBadge role="admin" />);

      expect(container.querySelector('.MuiChip-colorWarning')).not.toBeInTheDocument();
    });
  });
});
