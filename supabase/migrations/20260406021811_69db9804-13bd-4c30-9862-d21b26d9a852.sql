
ALTER TABLE public.applications
  ADD COLUMN current_version text DEFAULT null,
  ADD COLUMN min_version text DEFAULT null;
