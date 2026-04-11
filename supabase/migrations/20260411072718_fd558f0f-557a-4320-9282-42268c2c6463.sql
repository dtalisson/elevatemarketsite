-- Table for admin panel login attempts
CREATE TABLE public.admin_login_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text,
  user_agent text,
  fingerprint text,
  username_attempted text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  failure_reason text,
  country text,
  city text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_login_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view
CREATE POLICY "Admins can view admin login logs"
ON public.admin_login_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- No insert/update/delete from client (only edge function with service role)

-- Index for fast queries
CREATE INDEX idx_admin_login_logs_created_at ON public.admin_login_logs (created_at DESC);
CREATE INDEX idx_admin_login_logs_ip ON public.admin_login_logs (ip_address);