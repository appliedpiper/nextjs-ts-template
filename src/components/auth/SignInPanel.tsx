'use client';

import { SignIn } from '@clerk/nextjs';
import { Box, useTheme } from '@mui/material';

import { clerkAppearanceVariables } from '@/lib/clerkAppearance';

/**
 * Clerk's <SignIn /> widget, centered in the viewport and restyled to match the
 * MUI theme.
 *
 * Clerk's own component is kept rather than rebuilt from MUI inputs so OAuth,
 * MFA, and forgot-password keep working; only the styling is ours. Appearance
 * variables are read from the live theme via `useTheme()` instead of being
 * hardcoded, so editing `src/lib/theme.ts` restyles this page too.
 */
export default function SignInPanel() {
  const theme = useTheme();

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        bgcolor: 'background.default',
      }}
    >
      <SignIn
        appearance={{
          variables: clerkAppearanceVariables(theme),
          elements: {
            cardBox: { boxShadow: theme.shadows[8] },
          },
        }}
      />
    </Box>
  );
}
