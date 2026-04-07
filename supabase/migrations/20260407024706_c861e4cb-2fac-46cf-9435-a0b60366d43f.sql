
-- Pre-auth tokens for challenge/response handshake
CREATE TABLE public.pre_auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  hwid TEXT,
  token TEXT NOT NULL UNIQUE,
  used BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Auto-cleanup: index for expiration queries
CREATE INDEX idx_pre_auth_tokens_expires ON public.pre_auth_tokens(expires_at);
CREATE INDEX idx_pre_auth_tokens_token ON public.pre_auth_tokens(token);

-- Security logs from client-side anti-debug/anti-crack detections
CREATE TABLE public.security_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  username TEXT,
  hwid TEXT,
  event_type TEXT NOT NULL,
  details TEXT,
  client_timestamp BIGINT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_logs_app ON public.security_logs(application_id);
CREATE INDEX idx_security_logs_created ON public.security_logs(created_at DESC);

-- RLS
ALTER TABLE public.pre_auth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

-- Security logs: owners can view logs of their apps
CREATE POLICY "Owners can view security logs"
ON public.security_logs FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.applications
  WHERE applications.id = security_logs.application_id
  AND applications.owner_id = auth.uid()
));

-- Pre-auth tokens: owners can view tokens of their apps
CREATE POLICY "Owners can view pre_auth_tokens"
ON public.pre_auth_tokens FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.applications
  WHERE applications.id = pre_auth_tokens.application_id
  AND applications.owner_id = auth.uid()
));
