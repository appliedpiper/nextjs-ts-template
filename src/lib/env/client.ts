// src/lib/client.ts
import { z } from 'zod';
import { assertEnv } from './assertEnv';

// Declare the types for the environment variables
const _clientEnvSchema = z.object({
  NEXT_PUBLIC_GRAPHQL_SERVER: z.string().url(),
});

export const clientEnv = assertEnv(_clientEnvSchema, {
  NEXT_PUBLIC_GRAPHQL_SERVER: process.env.NEXT_PUBLIC_GRAPHQL_SERVER,
});