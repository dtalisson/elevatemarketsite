
-- Table: panel_users
CREATE TABLE public.panel_users (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_by uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.panel_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view panel_users"
  ON public.panel_users FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create panel_users"
  ON public.panel_users FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = created_by);

CREATE POLICY "Admins can update panel_users"
  ON public.panel_users FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete panel_users"
  ON public.panel_users FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_panel_users_updated_at
  BEFORE UPDATE ON public.panel_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: panel_user_applications
CREATE TABLE public.panel_user_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  panel_user_id uuid NOT NULL REFERENCES public.panel_users(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  UNIQUE (panel_user_id, application_id)
);

ALTER TABLE public.panel_user_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view panel_user_applications"
  ON public.panel_user_applications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create panel_user_applications"
  ON public.panel_user_applications FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete panel_user_applications"
  ON public.panel_user_applications FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Add panel_user_id to licenses for tracking
ALTER TABLE public.licenses ADD COLUMN panel_user_id uuid REFERENCES public.panel_users(id) ON DELETE SET NULL;
