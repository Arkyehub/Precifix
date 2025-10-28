-- This script modifies the foreign key constraint on the 'quotes' table.
-- It ensures that if a vehicle is deleted from the 'client_vehicles' table,
-- any corresponding 'vehicle_id' in the 'quotes' table is set to NULL
-- instead of causing a foreign key violation error. This maintains data integrity
-- while allowing vehicles to be deleted from a client's profile.

-- First, drop the existing constraint to avoid conflicts.
-- The IF EXISTS clause prevents an error if the constraint doesn't exist.
ALTER TABLE public.quotes
DROP CONSTRAINT IF EXISTS quotes_vehicle_id_fkey;

-- Then, add the new constraint with the ON DELETE SET NULL action.
-- This links 'quotes.vehicle_id' to 'client_vehicles.id'.
ALTER TABLE public.quotes
ADD CONSTRAINT quotes_vehicle_id_fkey
FOREIGN KEY (vehicle_id)
REFERENCES public.client_vehicles(id)
ON DELETE SET NULL;