
-- Session tokens table for API auth with expiration
CREATE TABLE public.session_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  token TEXT NOT NULL,
  hwid TEXT,
  ip_address TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast token lookup
CREATE UNIQUE INDEX idx_session_tokens_token ON public.session_tokens(token);
CREATE INDEX idx_session_tokens_app_user ON public.session_tokens(application_id, username);
CREATE INDEX idx_session_tokens_expires ON public.session_tokens(expires_at);

-- Enable RLS
ALTER TABLE public.session_tokens ENABLE ROW LEVEL SECURITY;

-- Only app owners can view session tokens (dashboard)
CREATE POLICY "Owners can view session tokens"
ON public.session_tokens
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM applications
    WHERE applications.id = session_tokens.application_id
    AND applications.owner_id = auth.uid()
  )
);

-- Cleanup function for expired tokens (called periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.session_tokens
  WHERE expires_at < now() OR revoked = true;
$$;
