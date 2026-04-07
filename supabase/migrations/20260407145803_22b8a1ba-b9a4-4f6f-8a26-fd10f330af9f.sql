
CREATE POLICY "Owners can delete auth logs"
ON public.auth_logs
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM applications
  WHERE applications.id = auth_logs.application_id
  AND applications.owner_id = auth.uid()
));
