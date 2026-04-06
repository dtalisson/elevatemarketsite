-- Add plain password column
ALTER TABLE public.software_users ADD COLUMN IF NOT EXISTS password_plain text;

-- Allow owners to update software_users (needed for HWID reset)
CREATE POLICY "Owners can update software users"
ON public.software_users
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM applications
  WHERE applications.id = software_users.application_id
  AND applications.owner_id = auth.uid()
));