import type { Config } from 'jest';

// Jest configuration for a TypeScript project using ts-jest.
const config: Config = {
  preset: 'ts-jest',
  roots: ['<rootDir>/app', '<rootDir>/__tests__'],     // Specify Location of source and test files
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup/jest.setup.ts'],

  // Map TS path aliases to actual folders
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },

  // Specify test files to include or exclude
  testMatch: [
    '**/__tests__/**/*.(spec|test).(ts|tsx|js|jsx)'
  ],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },

  // Collect coverage information from source files
  collectCoverage: true,
};

export default config;
