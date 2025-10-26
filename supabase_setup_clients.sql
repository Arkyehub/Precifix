-- Adicionar a coluna 'vehicle' à tabela 'clients'
ALTER TABLE clients
ADD COLUMN vehicle text NULL;

-- Opcional: Se você quiser que a coluna 'vehicle' seja indexada para buscas mais rápidas (como na página de clientes)
-- CREATE INDEX clients_vehicle_idx ON clients (vehicle);