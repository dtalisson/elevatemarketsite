
-- Remove anon access to applications
REVOKE ALL ON public.applications FROM anon;

-- Remove public storage read
DROP POLICY IF EXISTS "Public can read downloads" ON storage.objects;

-- Add owner-only read for storage
CREATE POLICY "Owners can read download files" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'downloads'
  AND EXISTS (
    SELECT 1 FROM public.downloads d
    JOIN public.applications a ON a.id = d.application_id
    WHERE a.owner_id = auth.uid()
    AND d.file_path = name
  )
);
