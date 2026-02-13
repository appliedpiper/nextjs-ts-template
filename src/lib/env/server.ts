// src/lib/server.ts
import { z } from 'zod';
import { assertEnv } from './assertEnv';

// Declare the types for the environment variables
const serverEnvSchema = z.object({
  GRAPHQL_SERVER: z.string().url(),
});

let _env: z.infer<typeof serverEnvSchema> | null = null;

export function getServerEnv() {
  if (!_env) {
      _env = assertEnv(serverEnvSchema, {
        GRAPHQL_SERVER: process.env.GRAPHQL_SERVER,
      });
  }
  return _env;
}