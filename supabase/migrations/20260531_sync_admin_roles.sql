-- =============================================================================
-- Migration: Sync admin roles to Supabase Auth app_metadata
-- File: 20260531_sync_admin_roles.sql
--
-- Problem: admin_users.id is a CUID (TEXT) but auth.users.id is a UUID.
-- Solution: Add an authId UUID column to admin_users as a bridge, then
--   keep auth.users.raw_app_meta_data.role in sync via a trigger.
--
-- Flow:
--   1. link_admin_user_by_email(email) — called once per admin to populate authId
--   2. Trigger trg_sync_admin_role   — fires on INSERT / UPDATE to keep metadata fresh
--   3. Initial sync DO block          — links existing admin_users on migration run
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add authId column to admin_users
--    Nullable: populated on first Supabase Auth login or via link function.
-- ---------------------------------------------------------------------------
ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS "authId" UUID UNIQUE;

CREATE INDEX IF NOT EXISTS "admin_users_authId_idx" ON admin_users ("authId");

-- ---------------------------------------------------------------------------
-- 2. Trigger function: sync role → auth.users.raw_app_meta_data
--    Fires AFTER INSERT or UPDATE of role / authId / deletedAt on admin_users.
--    SECURITY DEFINER — runs as migration owner (superuser) to write auth schema.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_admin_role_to_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Nothing to do if we don't know the Supabase Auth user yet
  IF NEW."authId" IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW."deletedAt" IS NOT NULL THEN
    -- Soft-deleted admin: strip role so the JWT no longer grants access
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) - 'role'
    WHERE id = NEW."authId";
  ELSE
    -- Active admin: upsert role in app_metadata
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                          || jsonb_build_object('role', NEW.role::text)
    WHERE id = NEW."authId";
  END IF;

  RETURN NEW;
END;
$$;

-- Restrict: only the database itself (trigger context) should call this
REVOKE EXECUTE ON FUNCTION sync_admin_role_to_auth() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 3. Trigger on admin_users
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_sync_admin_role ON admin_users;

CREATE TRIGGER trg_sync_admin_role
  AFTER INSERT OR UPDATE OF role, "authId", "deletedAt"
  ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION sync_admin_role_to_auth();

-- ---------------------------------------------------------------------------
-- 4. link_admin_user_by_email(email)
--    Populates admin_users."authId" by matching on email, then the trigger
--    automatically syncs the role to auth.users.raw_app_meta_data.
--
--    Call this from an Edge Function after an admin completes their first
--    Supabase Auth sign-in (or from the admin invite flow in Phase 2).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION link_admin_user_by_email(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auth_id  UUID;
  v_admin_id TEXT;
  v_role     TEXT;
BEGIN
  -- Find the Supabase Auth user by email
  SELECT id INTO v_auth_id
  FROM auth.users
  WHERE email = lower(trim(p_email))
  LIMIT 1;

  IF v_auth_id IS NULL THEN
    RETURN jsonb_build_object(
      'linked', false,
      'reason', 'no_auth_user',
      'email',  p_email
    );
  END IF;

  -- Find the active admin record
  SELECT id, role::text INTO v_admin_id, v_role
  FROM admin_users
  WHERE email = lower(trim(p_email))
    AND "deletedAt" IS NULL
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object(
      'linked', false,
      'reason', 'no_admin_record',
      'email',  p_email
    );
  END IF;

  -- Set authId — the trigger will sync the role automatically
  UPDATE admin_users
  SET "authId" = v_auth_id
  WHERE id = v_admin_id;

  RETURN jsonb_build_object(
    'linked',   true,
    'adminId',  v_admin_id,
    'authId',   v_auth_id,
    'role',     v_role,
    'email',    p_email
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION link_admin_user_by_email(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION link_admin_user_by_email(TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION link_admin_user_by_email(TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION link_admin_user_by_email(TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Initial sync: link all existing admin_users to auth.users by email
--    This is idempotent — safe to re-run. Only updates rows where authId
--    is not yet populated.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  rec    RECORD;
  result JSONB;
BEGIN
  FOR rec IN
    SELECT email
    FROM admin_users
    WHERE "deletedAt" IS NULL
      AND "authId" IS NULL
  LOOP
    result := link_admin_user_by_email(rec.email);
    IF (result->>'linked')::boolean THEN
      RAISE NOTICE 'Linked admin %: role=%, authId=%',
        result->>'email',
        result->>'role',
        result->>'authId';
    ELSE
      RAISE NOTICE 'Skipped admin %: % (no Supabase Auth account yet — will sync on first login)',
        result->>'email',
        result->>'reason';
    END IF;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- VERIFICATION QUERY (run manually to confirm sync state)
-- ---------------------------------------------------------------------------
-- SELECT
--   adm.email,
--   adm.role          AS admin_table_role,
--   adm."authId"      AS supabase_auth_id,
--   au.raw_app_meta_data->>'role' AS metadata_role,
--   CASE
--     WHEN adm."authId" IS NULL THEN 'NOT_LINKED'
--     WHEN au.raw_app_meta_data->>'role' = adm.role::text THEN 'IN_SYNC'
--     ELSE 'OUT_OF_SYNC'
--   END AS sync_status
-- FROM admin_users adm
-- LEFT JOIN auth.users au ON au.id = adm."authId"
-- WHERE adm."deletedAt" IS NULL
-- ORDER BY adm.email;
