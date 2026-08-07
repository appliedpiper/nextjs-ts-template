import { createTheme } from '@mui/material';

// Single source of truth for the MUI theme. Currently MUI's defaults — extend
// here and both the app chrome and the Clerk sign-in appearance follow, since
// SignInPanel derives Clerk's appearance variables from these values.
export const theme = createTheme();
