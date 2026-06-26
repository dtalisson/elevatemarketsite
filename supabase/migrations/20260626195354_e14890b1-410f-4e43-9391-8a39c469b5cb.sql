
-- Revoke EXECUTE on internal SECURITY DEFINER functions from public/anon/authenticated.
-- These are called by edge functions (service_role) or by RLS policies (has_role kept for authenticated).
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_sessions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_account_locked(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clear_lockout(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_blacklisted(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_license_users() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_license_on_user_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_failed_login(text, uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
-- has_role must remain callable by authenticated because RLS policies invoke it
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

-- panel_users: hide password_hash column from authenticated SELECT
REVOKE SELECT ON public.panel_users FROM authenticated;
GRANT SELECT (id, username, created_by, is_active, expires_at, created_at, updated_at) ON public.panel_users TO authenticated;

-- software_users: hide password_hash column from authenticated SELECT
REVOKE SELECT ON public.software_users FROM authenticated;
GRANT SELECT (id, license_id, application_id, username, hwid, created_at, updated_at, ip_address, last_ip, last_login_at) ON public.software_users TO authenticated;

-- rate_limits: ensure no direct client access (only SECURITY DEFINER function check_rate_limit touches it via service_role)
REVOKE ALL ON public.rate_limits FROM PUBLIC, anon, authenticated;

-- session_tokens: explicitly deny INSERT for clients; tokens only created by edge functions using service_role
REVOKE INSERT ON public.session_tokens FROM PUBLIC, anon, authenticated;

-- user_roles: prevent privilege escalation — block direct writes from clients; roles managed only by trigger / service_role
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM PUBLIC, anon, authenticated;
