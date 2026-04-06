ALTER TABLE public.applications ADD COLUMN msg_outdated text DEFAULT NULL;
ALTER TABLE public.applications ADD COLUMN msg_disabled text DEFAULT NULL;
ALTER TABLE public.applications ADD COLUMN msg_maintenance text DEFAULT NULL;