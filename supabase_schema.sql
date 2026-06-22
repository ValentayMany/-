-- Cloudflare deployment schema.
-- This script is intentionally non-destructive so existing roster data is not dropped.

CREATE TABLE IF NOT EXISTS public.staff (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    department text NOT NULL,
    rate_per_shift numeric NOT NULL DEFAULT 0,
    notes text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.shifts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    shift_date date NOT NULL,
    shift_count numeric NOT NULL DEFAULT 1,
    UNIQUE (staff_id, shift_date)
);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select on staff" ON public.staff;
CREATE POLICY "Allow select on staff"
ON public.staff FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert on staff" ON public.staff;
CREATE POLICY "Allow insert on staff"
ON public.staff FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update on staff" ON public.staff;
CREATE POLICY "Allow update on staff"
ON public.staff FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow delete on staff" ON public.staff;
CREATE POLICY "Allow delete on staff"
ON public.staff FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow select on shifts" ON public.shifts;
CREATE POLICY "Allow select on shifts"
ON public.shifts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert on shifts" ON public.shifts;
CREATE POLICY "Allow insert on shifts"
ON public.shifts FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update on shifts" ON public.shifts;
CREATE POLICY "Allow update on shifts"
ON public.shifts FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow delete on shifts" ON public.shifts;
CREATE POLICY "Allow delete on shifts"
ON public.shifts FOR DELETE USING (true);

-- Create app_users table to store login users (bypasses Supabase Auth email signup rate limits)
CREATE TABLE IF NOT EXISTS public.app_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username text UNIQUE NOT NULL,
    password text NOT NULL,
    role text NOT NULL DEFAULT 'data_entry',
    department text
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- Allow select access (needed for checking logins)
DROP POLICY IF EXISTS "Allow select on app_users" ON public.app_users;
CREATE POLICY "Allow select on app_users" 
ON public.app_users FOR SELECT USING (true);

-- Allow insert access for creating new users
DROP POLICY IF EXISTS "Allow insert on app_users" ON public.app_users;
CREATE POLICY "Allow insert on app_users" 
ON public.app_users FOR INSERT WITH CHECK (true);

-- Allow update access for modifying passwords/details
DROP POLICY IF EXISTS "Allow update on app_users" ON public.app_users;
CREATE POLICY "Allow update on app_users" 
ON public.app_users FOR UPDATE USING (true);

-- Allow delete access for removing users
DROP POLICY IF EXISTS "Allow delete on app_users" ON public.app_users;
CREATE POLICY "Allow delete on app_users" 
ON public.app_users FOR DELETE USING (true);

-- Insert initial users (default accounts)
INSERT INTO public.app_users (username, password, role, department) VALUES
('Pharmacy', 'PM1234', 'data_entry', null),
('Pharmacy1', 'PM1234', 'data_entry', null),
('Pharmacy2', 'PM1234', 'data_entry', null),
('Pharmacy3', 'PM1234', 'data_entry', null),
('Pharmacy4', 'PM1234', 'data_entry', null),
('Pharmacy5', 'PM1234', 'data_entry', null),
('Nurse', 'N12345', 'data_entry', null),
('Internal medicine', 'MED1234', 'data_entry', null),
('Pediatric Department', 'PED1234', 'data_entry', null),
('Laboratory Department', 'LAB1234', 'data_entry', null),
('Chauffeur', 'CF1234', 'data_entry', null),
('Admin', 'AD1234', 'admin', null)
ON CONFLICT (username) DO UPDATE SET 
    password = EXCLUDED.password,
    role = EXCLUDED.role,
    department = EXCLUDED.department;
