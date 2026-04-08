
-- Create downloads table
CREATE TABLE public.downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view downloads"
ON public.downloads FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM applications WHERE applications.id = downloads.application_id AND applications.owner_id = auth.uid()
));

CREATE POLICY "Owners can insert downloads"
ON public.downloads FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM applications WHERE applications.id = downloads.application_id AND applications.owner_id = auth.uid()
));

CREATE POLICY "Owners can update downloads"
ON public.downloads FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM applications WHERE applications.id = downloads.application_id AND applications.owner_id = auth.uid()
));

CREATE POLICY "Owners can delete downloads"
ON public.downloads FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM applications WHERE applications.id = downloads.application_id AND applications.owner_id = auth.uid()
));

-- Public read for download page (later)
CREATE POLICY "Public can view downloads"
ON public.downloads FOR SELECT TO anon
USING (true);

-- Create storage bucket for download files
INSERT INTO storage.buckets (id, name, public) VALUES ('downloads', 'downloads', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload downloads"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'downloads');

CREATE POLICY "Authenticated users can update downloads"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'downloads');

CREATE POLICY "Authenticated users can delete downloads"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'downloads');

CREATE POLICY "Public can read downloads"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'downloads');
