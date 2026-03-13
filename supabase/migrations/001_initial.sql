-- Users table
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  slack_user_id TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Punch records table
CREATE TABLE public.punch_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  punch_in TIMESTAMPTZ,
  punch_out TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Indexes
CREATE INDEX idx_users_slack_user_id ON public.users(slack_user_id);
CREATE INDEX idx_punch_records_user_date ON public.punch_records(user_id, date);

-- Helper function: check if current user is admin (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.users WHERE id = auth.uid()),
    FALSE
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.punch_records ENABLE ROW LEVEL SECURITY;

-- Users RLS policies
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (id = auth.uid() OR public.is_admin());

-- Punch records RLS policies
CREATE POLICY "Users can view own records"
  ON public.punch_records FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

-- INSERT/UPDATE via service_role only (Slack webhook + auth callback)
-- No INSERT/UPDATE policies for anon/authenticated — handled by admin client
