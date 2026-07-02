CREATE TABLE public.banned_hwids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hwid text NOT NULL UNIQUE,
  reason text,
  banned_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.banned_hwids TO authenticated;
GRANT ALL ON public.banned_hwids TO service_role;

ALTER TABLE public.banned_hwids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view banned hwids"
  ON public.banned_hwids FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert banned hwids"
  ON public.banned_hwids FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update banned hwids"
  ON public.banned_hwids FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete banned hwids"
  ON public.banned_hwids FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_banned_hwids_hwid ON public.banned_hwids(hwid);