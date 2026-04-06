
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.license_status AS ENUM ('active', 'expired', 'banned', 'unused');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);

CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  secret_key UUID NOT NULL DEFAULT gen_random_uuid(),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  license_key TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  status license_status NOT NULL DEFAULT 'unused',
  max_uses INT NOT NULL DEFAULT 1,
  current_uses INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  note TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claimed_by TEXT,
  hwid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_licenses_updated_at BEFORE UPDATE ON public.licenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can insert profiles" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Owners can view own apps" ON public.applications FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners can create apps" ON public.applications FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update own apps" ON public.applications FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners can delete own apps" ON public.applications FOR DELETE USING (auth.uid() = owner_id);

CREATE POLICY "Creators can view own licenses" ON public.licenses FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Creators can create licenses" ON public.licenses FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update own licenses" ON public.licenses FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Creators can delete own licenses" ON public.licenses FOR DELETE USING (auth.uid() = created_by);
