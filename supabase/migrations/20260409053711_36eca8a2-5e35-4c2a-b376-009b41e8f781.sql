-- Drop all existing download storage policies
DROP POLICY IF EXISTS "Owners can upload download files" ON storage.objects;
DROP POLICY IF EXISTS "Owners can read download files" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update download files" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete download files" ON storage.objects;

-- Simple owner-only policies using application ownership
-- Upload: owner of any app can upload to downloads bucket
CREATE POLICY "Owner upload downloads"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'downloads'
  AND EXISTS (
    SELECT 1 FROM public.applications WHERE owner_id = auth.uid()
  )
);

-- Read: owner can read files that are linked to their apps via downloads table
CREATE POLICY "Owner read downloads"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'downloads'
  AND EXISTS (
    SELECT 1 FROM public.downloads d
    JOIN public.applications a ON a.id = d.application_id
    WHERE a.owner_id = auth.uid()
    AND d.file_path = storage.objects.name
  )
);

-- Update: same as read
CREATE POLICY "Owner update downloads"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'downloads'
  AND EXISTS (
    SELECT 1 FROM public.downloads d
    JOIN public.applications a ON a.id = d.application_id
    WHERE a.owner_id = auth.uid()
    AND d.file_path = storage.objects.name
  )
);

-- Delete: same as read
CREATE POLICY "Owner delete downloads"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'downloads'
  AND EXISTS (
    SELECT 1 FROM public.downloads d
    JOIN public.applications a ON a.id = d.application_id
    WHERE a.owner_id = auth.uid()
    AND d.file_path = storage.objects.name
  )
);