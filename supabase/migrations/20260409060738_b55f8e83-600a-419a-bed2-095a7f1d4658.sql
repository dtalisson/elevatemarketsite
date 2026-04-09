-- Drop the overly permissive upload policy
DROP POLICY IF EXISTS "Owner upload downloads" ON storage.objects;

-- Create a tighter policy that checks the upload path matches an owned application
CREATE POLICY "Owner upload downloads" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'downloads'
  AND EXISTS (
    SELECT 1 FROM public.applications
    WHERE applications.id = (split_part(objects.name, '/', 1))::uuid
      AND applications.owner_id = auth.uid()
  )
);