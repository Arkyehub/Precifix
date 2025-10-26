-- 1. Create the clients table
CREATE TABLE public.clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    document_number text,
    phone_number text,
    email text,
    address text,
    city text,
    state text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 2. Set primary key and indexes
ALTER TABLE public.clients ADD CONSTRAINT clients_pkey PRIMARY KEY (id);
CREATE INDEX clients_user_id_idx ON public.clients USING btree (user_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies

-- Policy for SELECT: Users can only see their own clients
CREATE POLICY "Users can view their own clients"
ON public.clients FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy for INSERT: Users can only insert clients with their own user_id
CREATE POLICY "Users can insert their own clients"
ON public.clients FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy for UPDATE: Users can only update their own clients
CREATE POLICY "Users can update their own clients"
ON public.clients FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy for DELETE: Users can only delete their own clients
CREATE POLICY "Users can delete their own clients"
ON public.clients FOR DELETE
TO authenticated
USING (auth.uid() = user_id);