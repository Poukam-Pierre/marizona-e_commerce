/**
 * Standardised HTTP response helpers for Edge Functions.
 * All responses include CORS headers so that browsers can reach the functions.
 */

// ---------------------------------------------------------------------------
// CORS headers — same set used across all response helpers
// ---------------------------------------------------------------------------

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

/**
 * Return a JSON response with CORS headers.
 *
 * @param data    Any serialisable value — will be JSON.stringify'd.
 * @param status  HTTP status code (default 200).
 */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

/**
 * Return a structured error JSON response with CORS headers.
 *
 * @param message  Human-readable error message.
 * @param status   HTTP status code (default 400).
 * @param details  Optional additional detail payload (e.g. validation errors).
 */
export function errorResponse(
  message: string,
  status = 400,
  details?: unknown,
): Response {
  return jsonResponse(
    {
      error: message,
      statusCode: status,
      ...(details !== undefined ? { details } : {}),
    },
    status,
  );
}

/**
 * Return a pre-flight CORS response for OPTIONS requests.
 * Every Edge Function that handles real requests must return this for OPTIONS.
 *
 * Usage:
 *   if (req.method === 'OPTIONS') return corsResponse();
 */
export function corsResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * Return a paginated data response in the standard API envelope format:
 * { data, meta: { page, limit, total, totalPages }, statusCode, timestamp }
 */
export function paginatedResponse(
  data: unknown[],
  meta: { page: number; limit: number; total: number },
  status = 200,
): Response {
  const totalPages = Math.ceil(meta.total / meta.limit);
  return jsonResponse(
    {
      data,
      meta: { ...meta, totalPages },
      statusCode: status,
      timestamp: new Date().toISOString(),
    },
    status,
  );
}
