
-- 1. Remove tables from realtime publication (ignore error if not present)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.auth_logs;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.security_logs;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
$$;

-- 2. Fix storage policies
DROP POLICY IF EXISTS "Authenticated users can delete files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;

CREATE POLICY "Owners can upload download files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'downloads'
  AND EXISTS (
    SELECT 1 FROM public.applications
    WHERE applications.owner_id = auth.uid()
  )
);

CREATE POLICY "Owners can update download files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'downloads'
  AND EXISTS (
    SELECT 1 FROM public.applications
    WHERE applications.owner_id = auth.uid()
  )
);

CREATE POLICY "Owners can delete download files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'downloads'
  AND EXISTS (
    SELECT 1 FROM public.applications
    WHERE applications.owner_id = auth.uid()
  )
);

-- 3. Drop password_plain column
ALTER TABLE public.software_users DROP COLUMN IF EXISTS password_plain;
