// Role vocabulary and safe parsing of the role out of a Clerk session token.
// Kept free of Clerk/Next imports so it can be unit tested directly.

export const ROLES = ['admin', 'user'] as const;

export type Role = (typeof ROLES)[number];

// The shape we actually rely on, rather than Clerk's full claim type. The role
// only reaches the token if the Clerk Dashboard is configured with the
// `{ "metadata": "{{user.public_metadata}}" }` session claim, so every level
// here has to be treated as possibly absent.
type ClaimsLike =
  | { metadata?: { role?: unknown } | null }
  | null
  | undefined;

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

// Returns undefined for an absent, misspelled, or non-string role so callers
// fail closed instead of trusting an unrecognised value.
export function getRole(claims: ClaimsLike): Role | undefined {
  const raw = claims?.metadata?.role;
  return isRole(raw) ? raw : undefined;
}

export function hasRole(claims: ClaimsLike, role: Role): boolean {
  return getRole(claims) === role;
}

export function isAdmin(claims: ClaimsLike): boolean {
  return hasRole(claims, 'admin');
}

// `user` means "any signed-in account". A signed-in user whose role claim is
// missing still satisfies it — the role is only decisive for `admin`.
export function satisfiesRole(actual: Role | undefined, required: Role): boolean {
  return required === 'user' ? true : actual === 'admin';
}
