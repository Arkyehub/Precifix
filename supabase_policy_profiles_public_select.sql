-- This script resolves conflicting SELECT policies on the 'profiles' table.
-- It ensures that public access for quote viewing works correctly.

-- First, drop the two existing conflicting policies identified from user screenshots.
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "Allow public read of profiles by ID" ON public.profiles;

-- Then, create a single, definitive policy that allows public read access.
-- This is necessary for the public quote view page to display company information.
CREATE POLICY "Enable public read access for all users"
ON public.profiles
FOR SELECT
USING (true);