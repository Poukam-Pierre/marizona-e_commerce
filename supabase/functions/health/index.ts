import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { jsonResponse, corsResponse } from '../_shared/response.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  return jsonResponse({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});
