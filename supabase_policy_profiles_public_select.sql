-- FINAL FIX: This script resolves conflicting SELECT policies on the 'profiles' table.
-- It ensures that public, anonymous access for viewing company information on quotes works correctly.

-- First, drop all potentially conflicting SELECT policies to ensure a clean state.
DROP POLICY IF EXISTS "Allow public read access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles; -- Dropping this just in case it exists.

-- Then, create a single, definitive policy that allows public read access for everyone (anon and authenticated).
-- This is necessary for the public quote view page to fetch company details.
CREATE POLICY "Enable public read access for all users"
ON public.profiles
FOR SELECT
USING (true);