/**
 * Input validation and sanitisation helpers for Edge Functions.
 *
 * All functions are pure (no I/O) — safe to call synchronously anywhere.
 * These helpers validate data received at function boundaries before it
 * reaches the database, defending against OWASP A03 (Injection).
 */

// ---------------------------------------------------------------------------
// Required-field checks
// ---------------------------------------------------------------------------

/**
 * Verify that all listed fields are present, non-null, and non-empty on `obj`.
 * Returns a human-readable error string on the first missing field, or `null`
 * when every field is present.
 */
export function validateRequired(
  obj: Record<string, unknown>,
  fields: string[],
): string | null {
  for (const field of fields) {
    const value = obj[field];
    if (value === undefined || value === null || value === '') {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Format validators
// ---------------------------------------------------------------------------

/**
 * Basic RFC 5322-compatible e-mail format check.
 * Does not DNS-verify the domain — use only for format validation at the edge.
 */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * E.164-compatible phone number check.
 * Strips spaces, dashes, and parentheses before testing, then requires an
 * optional leading `+`, followed by 7–15 digits.
 */
export function validatePhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()\+]/g, '');
  return /^[1-9]\d{6,14}$/.test(cleaned);
}

/**
 * Return true when `id` looks like a Prisma-generated CUID
 * (starts with `c`, followed by at least 24 lowercase alphanumeric chars).
 */
export function validateCuid(id: string): boolean {
  return /^c[a-z0-9]{24,}$/.test(id);
}

/**
 * Return true when `id` is a valid UUID v4.
 */
export function validateUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
}

/**
 * Generate a Prisma-like CUID string for environments where DB defaults are
 * missing and IDs must be provided explicitly on insert.
 */
export function generateCuid(): string {
  const timestamp = Date.now().toString(36);
  const randomBytes = crypto.getRandomValues(new Uint8Array(20));
  let random = '';

  for (const b of randomBytes) {
    random += (b % 36).toString(36);
  }

  return `c${(timestamp + random).slice(0, 24)}`;
}

/**
 * Return true when `value` is a finite positive number.
 */
export function validatePositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

// ---------------------------------------------------------------------------
// Sanitisation
// ---------------------------------------------------------------------------

/**
 * Strip leading/trailing whitespace and remove `<` `>` characters to prevent
 * trivial HTML injection.
 *
 * Does NOT perform full HTML escaping — the database (PostgreSQL) and the
 * Supabase client handle parameterised queries, so only basic stripping is
 * needed here.
 */
export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

/**
 * Sanitise every string value in an object shallowly.
 * Non-string values are left unchanged.
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      typeof v === 'string' ? sanitizeInput(v) : v,
    ]),
  ) as T;
}

// ---------------------------------------------------------------------------
// Pagination helpers
// ---------------------------------------------------------------------------

/**
 * Parse and clamp a `page` query parameter to a minimum of 1.
 * Falls back to 1 for any non-numeric or out-of-range input.
 */
export function validatePage(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/**
 * Parse and clamp a `limit` query parameter to the range [1, maxLimit].
 * Falls back to `defaultLimit` (10) when the input is invalid.
 */
export function validateLimit(
  raw: unknown,
  maxLimit = 100,
  defaultLimit = 10,
): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1
    ? Math.min(Math.floor(n), maxLimit)
    : defaultLimit;
}

// ---------------------------------------------------------------------------
// Enum helpers
// ---------------------------------------------------------------------------

/**
 * Return true when `value` is a member of the provided string-enum object.
 *
 * @example
 *   validateEnum('PHYSICAL', ProductType)  // true
 *   validateEnum('INVALID', ProductType)   // false
 */
export function validateEnum<T extends Record<string, string>>(
  value: unknown,
  enumObj: T,
): value is T[keyof T] {
  return typeof value === 'string' && Object.values(enumObj).includes(value);
}
