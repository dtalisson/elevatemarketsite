
CREATE OR REPLACE FUNCTION public.cleanup_expired_license_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IN ('expired', 'banned') AND OLD.status NOT IN ('expired', 'banned') THEN
    DELETE FROM public.software_users WHERE license_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
