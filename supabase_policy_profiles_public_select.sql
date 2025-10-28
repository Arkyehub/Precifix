-- This policy allows anyone (including unauthenticated users) to read data from the 'profiles' table.
-- This is necessary for the public quote view page (/quote/view/:id) to display the
-- information of the company that generated the quote.
-- The information in the 'profiles' table is considered public in the context of a quote.

-- Drop the policy if it already exists to ensure a clean update.
DROP POLICY IF EXISTS "Enable public read access for all users" ON public.profiles;

-- Create the policy for SELECT (read) operations.
-- The USING (true) clause means this policy applies to all rows for all users.
CREATE POLICY "Enable public read access for all users"
ON public.profiles
FOR SELECT
USING (true);