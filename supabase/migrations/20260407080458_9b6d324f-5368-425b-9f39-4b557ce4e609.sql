CREATE OR REPLACE FUNCTION public.reset_license_on_user_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_status public.license_status;
BEGIN
  SELECT status
  INTO current_status
  FROM public.licenses
  WHERE id = OLD.license_id;

  IF current_status IS NULL THEN
    RETURN OLD;
  END IF;

  IF current_status IN ('banned', 'expired') THEN
    RETURN OLD;
  END IF;

  UPDATE public.licenses
  SET
    status = 'unused',
    claimed_by = NULL,
    current_uses = GREATEST(current_uses - 1, 0),
    hwid = NULL,
    activated_at = NULL
  WHERE id = OLD.license_id;

  RETURN OLD;
END;
$function$;