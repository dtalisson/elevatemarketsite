-- Restore table permissions that were accidentally removed
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT SELECT ON public.applications TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.licenses TO authenticated;
GRANT SELECT ON public.licenses TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.software_users TO authenticated;
GRANT SELECT ON public.software_users TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.auth_logs TO authenticated;
GRANT SELECT ON public.auth_logs TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_logs TO authenticated;
GRANT SELECT ON public.security_logs TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.blacklist TO authenticated;
GRANT SELECT ON public.blacklist TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.downloads TO authenticated;
GRANT SELECT ON public.downloads TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_tokens TO authenticated;
GRANT SELECT ON public.session_tokens TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pre_auth_tokens TO authenticated;
GRANT SELECT ON public.pre_auth_tokens TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

GRANT SELECT ON public.user_roles TO authenticated;

GRANT SELECT ON public.software_users_safe TO authenticated;
GRANT SELECT ON public.software_users_safe TO anon;