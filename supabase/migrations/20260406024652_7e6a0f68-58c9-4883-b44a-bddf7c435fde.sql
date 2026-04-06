
-- Create auth_logs table for tracking all events
CREATE TABLE public.auth_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES public.applications(id) ON DELETE CASCADE NOT NULL,
  license_id uuid REFERENCES public.licenses(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  username text,
  ip_address text,
  hwid text,
  success boolean NOT NULL DEFAULT false,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add IP and last login to software_users
ALTER TABLE public.software_users
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS last_ip text,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- Add activated_at to licenses
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS activated_at timestamptz;

-- Enable RLS on auth_logs
ALTER TABLE public.auth_logs ENABLE ROW LEVEL SECURITY;

-- Owners can view logs for their apps
CREATE POLICY "Owners can view auth logs"
  ON public.auth_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications
      WHERE applications.id = auth_logs.application_id
      AND applications.owner_id = auth.uid()
    )
  );

-- Enable realtime for auth_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.auth_logs;
