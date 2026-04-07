
-- 1. Make license deletion cascade to software_users
ALTER TABLE public.software_users DROP CONSTRAINT software_users_license_id_fkey;
ALTER TABLE public.software_users ADD CONSTRAINT software_users_license_id_fkey 
  FOREIGN KEY (license_id) REFERENCES public.licenses(id) ON DELETE CASCADE;

-- 2. When a software_user is deleted, reset the license back to unused
CREATE OR REPLACE FUNCTION public.reset_license_on_user_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.licenses SET
    status = 'unused',
    claimed_by = NULL,
    current_uses = GREATEST(current_uses - 1, 0),
    hwid = NULL,
    activated_at = NULL
  WHERE id = OLD.license_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_software_user_delete
  AFTER DELETE ON public.software_users
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_license_on_user_delete();
