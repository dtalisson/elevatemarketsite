
-- Allow owners to delete pre_auth_tokens
CREATE POLICY "Owners can delete pre_auth_tokens" ON public.pre_auth_tokens
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.applications
    WHERE applications.id = pre_auth_tokens.application_id
    AND applications.owner_id = auth.uid()
  )
);

-- Allow owners to delete session_tokens
CREATE POLICY "Owners can delete session_tokens" ON public.session_tokens
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.applications
    WHERE applications.id = session_tokens.application_id
    AND applications.owner_id = auth.uid()
  )
);

-- Allow owners to revoke session_tokens
CREATE POLICY "Owners can update session_tokens" ON public.session_tokens
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.applications
    WHERE applications.id = session_tokens.application_id
    AND applications.owner_id = auth.uid()
  )
);
