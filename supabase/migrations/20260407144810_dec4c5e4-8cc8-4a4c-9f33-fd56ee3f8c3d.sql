
-- Add ban_reason and remaining_seconds to licenses
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS ban_reason text;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS remaining_seconds bigint;

-- Update cleanup function to NOT delete users on ban/expire
CREATE OR REPLACE FUNCTION public.cleanup_expired_license_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- No longer delete users when license is banned or expired
  -- Users stay linked so admin can reactivate
  RETURN NEW;
END;
$function$;
