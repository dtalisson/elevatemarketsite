
CREATE TABLE public.panel_user_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  panel_user_id uuid NOT NULL REFERENCES public.panel_users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  details text,
  ip_address text,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.panel_user_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view panel user logs"
ON public.panel_user_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete panel user logs"
ON public.panel_user_logs FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_panel_user_logs_panel_user_id ON public.panel_user_logs(panel_user_id);
CREATE INDEX idx_panel_user_logs_created_at ON public.panel_user_logs(created_at DESC);
CREATE INDEX idx_panel_user_logs_event_type ON public.panel_user_logs(event_type);
