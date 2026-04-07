DROP TRIGGER IF EXISTS on_license_status_change ON public.licenses;

CREATE TRIGGER on_license_status_change
AFTER UPDATE OF status ON public.licenses
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_expired_license_users();