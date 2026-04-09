
-- 1. FORCE remove old overly-permissive storage policies
DROP POLICY IF EXISTS "Authenticated users can delete downloads" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update downloads" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload downloads" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;

-- 2. Create a secure view for software_users that excludes password_hash
CREATE OR REPLACE VIEW public.software_users_safe AS
SELECT 
  id, application_id, username, hwid, ip_address, 
  last_ip, last_login_at, license_id, created_at, updated_at
FROM public.software_users;

-- 3. Revoke direct SELECT on password_hash from anon and authenticated
-- We use column-level GRANT to restrict access
REVOKE ALL ON public.software_users FROM anon;
REVOKE SELECT ON public.software_users FROM authenticated;
GRANT SELECT (id, application_id, username, hwid, ip_address, last_ip, last_login_at, license_id, created_at, updated_at) ON public.software_users TO authenticated;
GRANT DELETE ON public.software_users TO authenticated;
GRANT UPDATE (hwid, ip_address, last_ip, last_login_at, updated_at) ON public.software_users TO authenticated;

-- 4. Revoke direct SELECT on secret_key from authenticated for applications
REVOKE SELECT ON public.applications FROM authenticated;
GRANT SELECT (id, name, description, enabled, current_version, min_version, msg_disabled, msg_maintenance, msg_outdated, owner_id, created_at, updated_at) ON public.applications TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.applications TO authenticated;
