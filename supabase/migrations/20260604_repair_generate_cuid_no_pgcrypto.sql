-- ============================================================================
-- Migration: 20260604_repair_generate_cuid_no_pgcrypto.sql
--
-- Hotfix for environments where generate_cuid() still references
-- gen_random_bytes(), which fails when pgcrypto is unavailable.
--
-- This migration is intentionally idempotent and only redefines the function.
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_cuid()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_timestamp text;
  v_entropy   text;
  v_random    text;
BEGIN
  -- No pgcrypto dependency (gen_random_bytes); works on plain PostgreSQL/Supabase.
  v_timestamp := lpad(to_hex(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint), 11, '0');
  v_entropy   := md5(random()::text || clock_timestamp()::text || txid_current()::text);
  v_random    := lower(substring(v_entropy FROM 1 FOR 20));
  RETURN 'c' || substring(v_timestamp || v_random FROM 1 FOR 24);
END;
$$;
