import type { Role } from '@/lib/auth/roles';

declare global {
  // Shape of the custom claims Clerk puts in the session token. Requires the
  // Clerk Dashboard session claim:
  //   { "metadata": "{{user.public_metadata}}" }
  // `metadata` is optional here because it is genuinely absent until that
  // claim is configured.
  interface CustomJwtSessionClaims {
    metadata?: {
      role?: Role;
    };
  }
}
