-- Drop existing tables to avoid constraint errors and start fresh
DROP TABLE IF EXISTS public.login_mappings CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.app_users CASCADE;

-- Create app_users table to store login users (bypasses Supabase Auth email signup rate limits)
CREATE TABLE IF NOT EXISTS public.app_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username text UNIQUE NOT NULL,
    password text NOT NULL,
    role text NOT NULL DEFAULT 'department',
    department text
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- Allow select access (needed for checking logins)
CREATE POLICY "Allow select on app_users" 
ON public.app_users FOR SELECT USING (true);

-- Allow insert access for creating new users
CREATE POLICY "Allow insert on app_users" 
ON public.app_users FOR INSERT WITH CHECK (true);

-- Allow update access for modifying passwords/details
CREATE POLICY "Allow update on app_users" 
ON public.app_users FOR UPDATE USING (true);

-- Allow delete access for removing users
CREATE POLICY "Allow delete on app_users" 
ON public.app_users FOR DELETE USING (true);

-- Insert initial users (default accounts)
INSERT INTO public.app_users (username, password, role, department) VALUES
('Pharmacy', 'PM1234', 'department', 'Pharmacy'),
('Pharmacy1', 'PM1234', 'department', 'Pharmacy'),
('Pharmacy2', 'PM1234', 'department', 'Pharmacy'),
('Pharmacy3', 'PM1234', 'department', 'Pharmacy'),
('Pharmacy4', 'PM1234', 'department', 'Pharmacy'),
('Pharmacy5', 'PM1234', 'department', 'Pharmacy'),
('Nurse', 'N12345', 'department', 'Nurse'),
('Internal medicine', 'MED1234', 'department', 'Internal medicine'),
('Pediatric Department', 'PED1234', 'department', 'Pediatric Department'),
('Laboratory Department', 'LAB1234', 'department', 'Laboratory Department'),
('Chauffeur', 'CF1234', 'department', 'Chauffeur'),
('Admin', 'AD1234', 'admin', null)
ON CONFLICT (username) DO UPDATE SET 
    password = EXCLUDED.password,
    role = EXCLUDED.role,
    department = EXCLUDED.department;
