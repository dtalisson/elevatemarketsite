-- Fix overly permissive upload policy
DROP POLICY IF EXISTS "Owners can upload download files" ON storage.objects;

CREATE POLICY "Owners can upload download files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'downloads'
  AND EXISTS (
    SELECT 1 FROM public.applications
    WHERE owner_id = auth.uid()
    AND name IS NOT NULL
    AND (storage.foldername(name))[1] = id::text
  )
);