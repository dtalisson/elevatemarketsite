
-- 1. Fix license INSERT policy: verify app ownership
DROP POLICY IF EXISTS "Creators can create licenses" ON public.licenses;
CREATE POLICY "Owners can create licenses" ON public.licenses
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND EXISTS (
    SELECT 1 FROM public.applications
    WHERE applications.id = licenses.application_id
    AND applications.owner_id = auth.uid()
  )
);

-- Fix license UPDATE policy
DROP POLICY IF EXISTS "Creators can update own licenses" ON public.licenses;
CREATE POLICY "Owners can update own licenses" ON public.licenses
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.applications
    WHERE applications.id = licenses.application_id
    AND applications.owner_id = auth.uid()
  )
);

-- Fix license DELETE policy
DROP POLICY IF EXISTS "Creators can delete own licenses" ON public.licenses;
CREATE POLICY "Owners can delete own licenses" ON public.licenses
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.applications
    WHERE applications.id = licenses.application_id
    AND applications.owner_id = auth.uid()
  )
);

-- Fix license SELECT policy
DROP POLICY IF EXISTS "Creators can view own licenses" ON public.licenses;
CREATE POLICY "Owners can view own licenses" ON public.licenses
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.applications
    WHERE applications.id = licenses.application_id
    AND applications.owner_id = auth.uid()
  )
);

-- 2. Fix storage policies to be app-specific
DROP POLICY IF EXISTS "Owners can upload download files" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update download files" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete download files" ON storage.objects;

CREATE POLICY "Owners can upload download files" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'downloads'
  AND EXISTS (
    SELECT 1 FROM public.downloads d
    JOIN public.applications a ON a.id = d.application_id
    WHERE a.owner_id = auth.uid()
    AND d.file_path = name
  )
);

CREATE POLICY "Owners can update download files" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'downloads'
  AND EXISTS (
    SELECT 1 FROM public.downloads d
    JOIN public.applications a ON a.id = d.application_id
    WHERE a.owner_id = auth.uid()
    AND d.file_path = name
  )
);

CREATE POLICY "Owners can delete download files" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'downloads'
  AND EXISTS (
    SELECT 1 FROM public.downloads d
    JOIN public.applications a ON a.id = d.application_id
    WHERE a.owner_id = auth.uid()
    AND d.file_path = name
  )
);

-- 3. Remove anonymous access to downloads table
DROP POLICY IF EXISTS "Public can view downloads" ON public.downloads;
