
-- Fix: change view to SECURITY INVOKER
ALTER VIEW public.software_users_safe SET (security_invoker = on);
