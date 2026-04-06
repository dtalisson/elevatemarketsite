
-- Trigger function to delete software_users when license expires or is banned
CREATE OR REPLACE FUNCTION public.cleanup_expired_license_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IN ('expired', 'banned') AND OLD.status NOT IN ('expired', 'banned') THEN
    DELETE FROM public.software_users WHERE license_id = NEW.id;
    NEW.claimed_by := NULL;
    NEW.current_uses := 0;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_license_status_change
  BEFORE UPDATE OF status ON public.licenses
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_expired_license_users();
