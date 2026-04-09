CREATE TABLE public.blacklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  ip_address text,
  hwid text,
  reason text,
  details text,
  source_log_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  active boolean NOT NULL DEFAULT true,
  CONSTRAINT blacklist_needs_ip_or_hwid CHECK (ip_address IS NOT NULL OR hwid IS NOT NULL)
);

ALTER TABLE public.blacklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view blacklist"
ON public.blacklist FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.applications WHERE id = blacklist.application_id AND owner_id = auth.uid()
));

CREATE POLICY "Owners can create blacklist entries"
ON public.blacklist FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND EXISTS (
    SELECT 1 FROM public.applications WHERE id = blacklist.application_id AND owner_id = auth.uid()
  )
);

CREATE POLICY "Owners can update blacklist"
ON public.blacklist FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.applications WHERE id = blacklist.application_id AND owner_id = auth.uid()
));

CREATE POLICY "Owners can delete blacklist"
ON public.blacklist FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.applications WHERE id = blacklist.application_id AND owner_id = auth.uid()
));

CREATE INDEX idx_blacklist_ip ON public.blacklist(ip_address) WHERE active = true;
CREATE INDEX idx_blacklist_hwid ON public.blacklist(hwid) WHERE active = true;
CREATE INDEX idx_blacklist_app ON public.blacklist(application_id);

-- Function for edge functions to check blacklist (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_blacklisted(
  p_app_id uuid,
  p_ip text DEFAULT NULL,
  p_hwid text DEFAULT NULL
)
RETURNS TABLE(blocked boolean, block_reason text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT true, b.reason
  FROM public.blacklist b
  WHERE b.application_id = p_app_id
    AND b.active = true
    AND (
      (p_ip IS NOT NULL AND b.ip_address = p_ip)
      OR (p_hwid IS NOT NULL AND b.hwid = p_hwid)
    )
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text;
  END IF;
END;
$$;