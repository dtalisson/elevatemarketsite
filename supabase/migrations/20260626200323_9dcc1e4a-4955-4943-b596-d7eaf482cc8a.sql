
-- applications: hide secret_key from authenticated SELECT; expose via owner-scoped RPC
REVOKE SELECT ON public.applications FROM authenticated;
GRANT SELECT (id, owner_id, name, description, enabled, created_at, updated_at, current_version, min_version, msg_outdated, msg_disabled, msg_maintenance) ON public.applications TO authenticated;

CREATE OR REPLACE FUNCTION public.get_application_secret(p_app_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT secret_key FROM public.applications
  WHERE id = p_app_id AND owner_id = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION public.get_application_secret(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_application_secret(uuid) TO authenticated;

-- pre_auth_tokens: hide token column from authenticated SELECT
REVOKE SELECT ON public.pre_auth_tokens FROM authenticated;
GRANT SELECT (id, application_id, username, hwid, used, expires_at, created_at) ON public.pre_auth_tokens TO authenticated;

-- session_tokens: hide token column from authenticated SELECT
REVOKE SELECT ON public.session_tokens FROM authenticated;
GRANT SELECT (id, application_id, username, hwid, ip_address, expires_at, revoked, created_at) ON public.session_tokens TO authenticated;
