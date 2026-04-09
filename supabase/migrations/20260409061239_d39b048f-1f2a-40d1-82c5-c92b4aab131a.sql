-- Revoke direct SELECT on software_users base table
REVOKE SELECT ON public.software_users FROM authenticated;
REVOKE SELECT ON public.software_users FROM anon;

-- Ensure the safe view is accessible
GRANT SELECT ON public.software_users_safe TO authenticated;
GRANT SELECT ON public.software_users_safe TO anon;