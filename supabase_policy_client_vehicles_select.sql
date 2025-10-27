EXISTS (
  SELECT 1
  FROM clients
  WHERE clients.id = client_vehicles.client_id
  AND clients.user_id = auth.uid()
)