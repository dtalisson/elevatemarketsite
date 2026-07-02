CREATE OR REPLACE FUNCTION public.record_hwid_failure(
  p_app_id uuid,
  p_hwid text,
  p_reason text,
  p_max integer DEFAULT 5,
  p_window_seconds integer DEFAULT 3600
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_count integer;
  v_owner uuid;
  v_exists boolean;
BEGIN
  IF p_hwid IS NULL OR length(p_hwid) = 0 OR p_app_id IS NULL THEN
    RETURN false;
  END IF;

  v_key := 'hwid_fail:' || p_app_id::text || ':' || p_hwid;

  INSERT INTO public.rate_limits (key, count, window_start)
  VALUES (v_key, 1, now())
  ON CONFLICT (key) DO UPDATE SET
    count = CASE
      WHEN rate_limits.window_start < now() - (p_window_seconds || ' seconds')::interval THEN 1
      ELSE rate_limits.count + 1
    END,
    window_start = CASE
      WHEN rate_limits.window_start < now() - (p_window_seconds || ' seconds')::interval THEN now()
      ELSE rate_limits.window_start
    END
  RETURNING count INTO v_count;

  IF v_count < p_max THEN
    RETURN false;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.blacklist
    WHERE application_id = p_app_id AND hwid = p_hwid AND active = true
  ) INTO v_exists;
  IF v_exists THEN
    RETURN true;
  END IF;

  SELECT owner_id INTO v_owner FROM public.applications WHERE id = p_app_id;
  IF v_owner IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.blacklist (application_id, hwid, reason, details, active, created_by)
  VALUES (
    p_app_id,
    p_hwid,
    COALESCE(p_reason, 'Auto: 5+ tentativas inválidas'),
    'Bloqueado automaticamente após ' || p_max || ' tentativas inválidas em 1h',
    true,
    v_owner
  );

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_hwid_failure(uuid, text, text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_hwid_failure(uuid, text, text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_hwid_failure(uuid, text, text, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_hwid_failure(uuid, text, text, integer, integer) TO service_role;