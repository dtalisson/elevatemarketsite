
-- Rate limiting table
CREATE TABLE public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  count integer NOT NULL DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(key)
);

-- No RLS needed - only accessed via SECURITY DEFINER function
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Rate limit check function (SECURITY DEFINER - no RLS bypass needed)
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text,
  p_max_requests integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_window_start timestamp with time zone;
BEGIN
  -- Clean expired entries periodically (1% chance per call)
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limits 
    WHERE window_start < now() - (p_window_seconds || ' seconds')::interval;
  END IF;

  -- Try to get existing entry
  SELECT count, window_start INTO v_count, v_window_start
  FROM public.rate_limits WHERE key = p_key;

  IF NOT FOUND THEN
    -- First request
    INSERT INTO public.rate_limits (key, count, window_start)
    VALUES (p_key, 1, now())
    ON CONFLICT (key) DO UPDATE SET count = rate_limits.count + 1;
    RETURN true;
  END IF;

  -- Check if window expired
  IF v_window_start < now() - (p_window_seconds || ' seconds')::interval THEN
    UPDATE public.rate_limits SET count = 1, window_start = now() WHERE key = p_key;
    RETURN true;
  END IF;

  -- Within window, check limit
  IF v_count >= p_max_requests THEN
    RETURN false; -- Rate limited
  END IF;

  -- Increment
  UPDATE public.rate_limits SET count = count + 1 WHERE key = p_key;
  RETURN true;
END;
$$;

-- Account lockout table
CREATE TABLE public.account_lockouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamp with time zone,
  last_attempt_at timestamp with time zone DEFAULT now(),
  UNIQUE(username, application_id)
);

ALTER TABLE public.account_lockouts ENABLE ROW LEVEL SECURITY;

-- Function to check/record failed login
CREATE OR REPLACE FUNCTION public.record_failed_login(
  p_username text,
  p_app_id uuid,
  p_max_attempts integer DEFAULT 5,
  p_lockout_seconds integer DEFAULT 900
)
RETURNS boolean -- returns true if account is now locked
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts integer;
  v_locked_until timestamp with time zone;
BEGIN
  INSERT INTO public.account_lockouts (username, application_id, failed_attempts, last_attempt_at)
  VALUES (p_username, p_app_id, 1, now())
  ON CONFLICT (username, application_id)
  DO UPDATE SET 
    failed_attempts = CASE 
      WHEN account_lockouts.locked_until IS NOT NULL AND account_lockouts.locked_until > now() THEN account_lockouts.failed_attempts
      WHEN account_lockouts.last_attempt_at < now() - interval '15 minutes' THEN 1
      ELSE account_lockouts.failed_attempts + 1 
    END,
    last_attempt_at = now(),
    locked_until = CASE 
      WHEN account_lockouts.locked_until IS NOT NULL AND account_lockouts.locked_until > now() THEN account_lockouts.locked_until
      WHEN (CASE 
        WHEN account_lockouts.last_attempt_at < now() - interval '15 minutes' THEN 1
        ELSE account_lockouts.failed_attempts + 1 
      END) >= p_max_attempts THEN now() + (p_lockout_seconds || ' seconds')::interval
      ELSE NULL
    END
  RETURNING failed_attempts, locked_until INTO v_attempts, v_locked_until;

  RETURN v_locked_until IS NOT NULL AND v_locked_until > now();
END;
$$;

-- Function to check if account is locked
CREATE OR REPLACE FUNCTION public.is_account_locked(p_username text, p_app_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_lockouts
    WHERE username = p_username 
    AND application_id = p_app_id
    AND locked_until IS NOT NULL 
    AND locked_until > now()
  );
$$;

-- Function to clear lockout on successful login
CREATE OR REPLACE FUNCTION public.clear_lockout(p_username text, p_app_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.account_lockouts
  WHERE username = p_username AND application_id = p_app_id;
$$;

-- Indexes
CREATE INDEX idx_rate_limits_key ON public.rate_limits(key);
CREATE INDEX idx_rate_limits_window ON public.rate_limits(window_start);
CREATE INDEX idx_account_lockouts_lookup ON public.account_lockouts(username, application_id);
