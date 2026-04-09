-- Re-grant SELECT on software_users for authenticated so the security_invoker view works
GRANT SELECT ON public.software_users TO authenticated;
