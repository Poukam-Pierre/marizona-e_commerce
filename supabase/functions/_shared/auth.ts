/**
 * Supabase Auth middleware helpers for Edge Functions.
 *
 * ⚠️ CRITICAL: Role is stored at `app_metadata.role` inside the JWT — NOT at the
 * top-level claim. All role checks must use `user.app_metadata?.role`.
 *
 * ⚠️ GUEST CHECKOUT: The storefront supports WhatsApp-based guest checkout where
 * `user_id IS NULL`. Public order-creation endpoints must NOT require authentication.
 */

import {
  createClient,
  type SupabaseClient,
  type User,
} from 'https://esm.sh/@supabase/supabase-js@2';

// ---------------------------------------------------------------------------
// Role types
// ---------------------------------------------------------------------------

export enum AdminRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  VIEWER = 'VIEWER',
}

/** Numeric level for each role — higher means more privilege. */
export const ROLE_LEVELS: Record<AdminRole, number> = {
  [AdminRole.SUPER_ADMIN]: 4,
  [AdminRole.ADMIN]: 3,
  [AdminRole.MANAGER]: 2,
  [AdminRole.VIEWER]: 1,
};

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface AuthResult {
  user?: User;
  error?: string;
  status?: number;
}

export interface RoleResult {
  role?: AdminRole;
  error?: string;
  status?: number;
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

/**
 * Extract and validate the Supabase Auth Bearer token from the request.
 * Returns the authenticated `User` or an error with an appropriate HTTP status.
 */
export async function authenticate(
  req: Request,
  supabase: SupabaseClient,
): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid Authorization header', status: 401 };
  }

  const token = authHeader.replace('Bearer ', '').trim();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { error: error?.message ?? 'Invalid or expired token', status: 401 };
  }

  return { user };
}

// ---------------------------------------------------------------------------
// Authorization — app_metadata-based (fast, no DB round-trip)
// ---------------------------------------------------------------------------

/**
 * Check that the user holds at least `minRole` (inclusive).
 * Role is read from `user.app_metadata.role` as set via `set_user_role()`.
 */
export function requireRole(user: User, minRole: AdminRole): RoleResult {
  const userRole = user.app_metadata?.role as AdminRole | undefined;

  if (!userRole) {
    return { error: 'No role assigned to this user', status: 403 };
  }

  const userLevel = ROLE_LEVELS[userRole] ?? 0;
  const requiredLevel = ROLE_LEVELS[minRole];

  if (userLevel < requiredLevel) {
    return {
      error: `Insufficient permissions. Required: ${minRole}, have: ${userRole}`,
      status: 403,
    };
  }

  return { role: userRole };
}

/**
 * Check that the user holds one of the explicitly listed roles (OR logic).
 * Prefer `requireRole` when a hierarchy minimum is sufficient.
 */
export function requireAnyRole(
  user: User,
  allowedRoles: AdminRole[],
): RoleResult {
  const userRole = user.app_metadata?.role as AdminRole | undefined;

  if (!userRole) {
    return { error: 'No role assigned to this user', status: 403 };
  }

  if (!allowedRoles.includes(userRole)) {
    return {
      error: `Access denied. Allowed roles: ${allowedRoles.join(', ')}`,
      status: 403,
    };
  }

  return { role: userRole };
}

// ---------------------------------------------------------------------------
// Authorization — admin_users table fallback (extra audit / double-check)
// ---------------------------------------------------------------------------

/**
 * Verify role by querying the `admin_users` table with the service-role client.
 * Use this when you need an extra DB-level audit trail in addition to JWT claims.
 * Requires a Supabase client created with the SERVICE_ROLE_KEY (bypasses RLS).
 */
export async function requireAdminRole(
  userId: string,
  allowedRoles: AdminRole[],
  supabaseAdmin: SupabaseClient,
): Promise<RoleResult> {
  const { data: adminUser, error } = await supabaseAdmin
    .from('admin_users')
    .select('role')
    .eq('id', userId)
    .is('deleted_at', null)
    .single();

  if (error || !adminUser) {
    return {
      error: 'Admin user not found or has been deactivated',
      status: 403,
    };
  }

  const role = adminUser.role as AdminRole;

  if (!allowedRoles.includes(role)) {
    return {
      error: `Access denied. Allowed roles: ${allowedRoles.join(', ')}`,
      status: 403,
    };
  }

  return { role };
}

// ---------------------------------------------------------------------------
// Supabase client factories (convenience re-exports for Edge Functions)
// ---------------------------------------------------------------------------

/**
 * Create a user-scoped Supabase client that respects Row Level Security.
 * Pass the raw Bearer token extracted from the incoming request.
 */
export function createUserClient(token: string): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
}

/**
 * Create a service-role Supabase client that bypasses Row Level Security.
 * Use sparingly — only for privileged operations that require it.
 */
export function createAdminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}
