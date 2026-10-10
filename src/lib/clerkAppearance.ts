// Maps the MUI theme onto Clerk's appearance variables.
//
// Shared so every Clerk widget in the app (the sign-in page, the header's user
// menu) is styled from one place. Reading `src/lib/theme.ts` through this keeps
// Clerk's chrome in step with ours instead of needing a second set of hardcoded
// colours per widget.
//
// Return type is left inferred on purpose: `@clerk/types` is a stub that
// re-exports `@clerk/shared/types`, and pinning Clerk's `Variables` type here
// would couple this module to that indirection.

import type { Theme } from '@mui/material/styles';

export function clerkAppearanceVariables(theme: Theme) {
  return {
    colorPrimary: theme.palette.primary.main,
    colorTextOnPrimaryBackground: theme.palette.primary.contrastText,
    colorText: theme.palette.text.primary,
    colorTextSecondary: theme.palette.text.secondary,
    colorBackground: theme.palette.background.paper,
    colorInputBackground: theme.palette.background.paper,
    colorInputText: theme.palette.text.primary,
    colorDanger: theme.palette.error.main,
    colorSuccess: theme.palette.success.main,
    colorWarning: theme.palette.warning.main,
    fontFamily: theme.typography.fontFamily,
    borderRadius: `${theme.shape.borderRadius}px`,
  };
}
