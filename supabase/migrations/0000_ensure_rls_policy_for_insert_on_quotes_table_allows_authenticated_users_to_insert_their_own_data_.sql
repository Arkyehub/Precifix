-- Enable RLS on quotes table (if not already enabled)
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- Drop existing insert policy if it's too restrictive or needs update
DROP POLICY IF EXISTS quotes_insert_policy ON quotes;

-- Create or replace a policy that allows authenticated users to insert their own quotes
CREATE POLICY "quotes_insert_policy" ON quotes
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);