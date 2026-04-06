
CREATE TABLE public.software_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id uuid NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  username text NOT NULL,
  password_hash text NOT NULL,
  hwid text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(application_id, username)
);

ALTER TABLE public.software_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view software users" ON public.software_users
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.applications WHERE id = software_users.application_id AND owner_id = auth.uid())
  );

CREATE POLICY "Owners can delete software users" ON public.software_users
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.applications WHERE id = software_users.application_id AND owner_id = auth.uid())
  );

CREATE TRIGGER update_software_users_updated_at
  BEFORE UPDATE ON public.software_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
