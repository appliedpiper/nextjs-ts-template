import { ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { theme } from '@/lib/theme';

type Appearance = {
  variables?: Record<string, unknown>;
  elements?: Record<string, unknown>;
};

const hoisted = vi.hoisted(() => ({
  props: { current: null as { appearance?: Appearance } | null },
}));

// Clerk's widget needs a live Clerk context, so stand in for it and inspect the
// styling it was handed.
vi.mock('@clerk/nextjs', () => ({
  SignIn: (props: { appearance?: Appearance }) => {
    hoisted.props.current = props;
    return <div data-testid="clerk-sign-in" />;
  },
}));

import SignInPanel from './SignInPanel';

function renderPanel() {
  return render(
    <ThemeProvider theme={theme}>
      <SignInPanel />
    </ThemeProvider>,
  );
}

describe('SignInPanel', () => {
  it("renders Clerk's sign-in widget", () => {
    renderPanel();

    expect(screen.getByTestId('clerk-sign-in')).toBeInTheDocument();
  });

  it('derives the appearance from the MUI theme rather than hardcoding colours', () => {
    renderPanel();

    const variables = hoisted.props.current?.appearance?.variables;

    expect(variables?.colorPrimary).toBe(theme.palette.primary.main);
    expect(variables?.colorDanger).toBe(theme.palette.error.main);
    expect(variables?.fontFamily).toBe(theme.typography.fontFamily);
    expect(variables?.borderRadius).toBe(`${theme.shape.borderRadius}px`);
  });

  it('centres the widget in the viewport', () => {
    const { container } = renderPanel();

    const box = container.firstElementChild as HTMLElement;
    const styles = getComputedStyle(box);

    expect(styles.display).toBe('flex');
    expect(styles.alignItems).toBe('center');
    expect(styles.justifyContent).toBe('center');
  });
});
