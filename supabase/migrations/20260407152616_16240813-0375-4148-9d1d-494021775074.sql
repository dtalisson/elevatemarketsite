CREATE POLICY "Owners can delete security logs"
ON public.security_logs
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM applications
  WHERE applications.id = security_logs.application_id
  AND applications.owner_id = auth.uid()
));