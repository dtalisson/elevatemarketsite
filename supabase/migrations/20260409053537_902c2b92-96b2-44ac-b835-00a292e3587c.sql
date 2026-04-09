-- 1. Make downloads bucket private
UPDATE storage.buckets SET public = false WHERE id = 'downloads';

-- 2. Drop broken storage policies
DROP POLICY IF EXISTS "Owners can upload download files" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update download files" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete download files" ON storage.objects;
DROP POLICY IF EXISTS "Owners can read download files" ON storage.objects;

-- 3. Recreate with correct path comparison (storage object name matches downloads.file_path)
CREATE POLICY "Owners can read download files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'downloads'
  AND EXISTS (
    SELECT 1 FROM public.downloads d
    JOIN public.applications a ON a.id = d.application_id
    WHERE a.owner_id = auth.uid()
    AND name = d.file_path
  )
);

CREATE POLICY "Owners can upload download files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'downloads'
  AND EXISTS (
    SELECT 1 FROM public.applications
    WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Owners can update download files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'downloads'
  AND EXISTS (
    SELECT 1 FROM public.downloads d
    JOIN public.applications a ON a.id = d.application_id
    WHERE a.owner_id = auth.uid()
    AND name = d.file_path
  )
);

CREATE POLICY "Owners can delete download files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'downloads'
  AND EXISTS (
    SELECT 1 FROM public.downloads d
    JOIN public.applications a ON a.id = d.application_id
    WHERE a.owner_id = auth.uid()
    AND name = d.file_path
  )
);