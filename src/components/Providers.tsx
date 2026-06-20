'use client';

import { ClerkProvider } from '@clerk/nextjs'
import { ThemeProvider, CssBaseline, createTheme } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import { useState } from 'react';

const theme = createTheme();

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ClerkProvider>
      <AppRouterCacheProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
          </ThemeProvider>
        </QueryClientProvider>
      </AppRouterCacheProvider>
    </ClerkProvider>
  );
}