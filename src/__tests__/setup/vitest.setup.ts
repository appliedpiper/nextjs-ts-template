import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Unmount anything rendered during a test so DOM state can't leak between tests.
afterEach(() => {
  cleanup();
});
