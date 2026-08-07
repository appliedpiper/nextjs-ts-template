'use client';

import { ClerkProvider } from '@clerk/nextjs'
import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import { useState } from 'react';

import { theme } from '@/lib/theme';

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