-- Enforce one user per license at the database level.
-- Prevents any possibility of the same license_key being registered by multiple users,
-- even under race conditions or edge function logic bugs.
ALTER TABLE public.software_users
  ADD CONSTRAINT software_users_license_id_unique UNIQUE (license_id);