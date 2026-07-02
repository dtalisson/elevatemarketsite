CREATE OR REPLACE FUNCTION public.unban_hwid(p_hwid text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_hwid IS NULL OR length(trim(p_hwid)) = 0 THEN
    RAISE EXCEPTION 'HWID inválido';
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem remover bans';
  END IF;

  -- Remove global HWID ban
  DELETE FROM public.banned_hwids WHERE hwid = p_hwid;

  -- Deactivate all blacklist entries for this HWID
  UPDATE public.blacklist SET active = false WHERE hwid = p_hwid AND active = true;

  -- Clear failure counters so auto-blacklist doesn't re-trigger instantly
  DELETE FROM public.rate_limits WHERE key LIKE 'hwid_fail:%:' || p_hwid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.unban_hwid(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.unban_hwid(text) TO authenticated, service_role;