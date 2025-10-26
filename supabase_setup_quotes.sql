-- Adicionar a coluna 'client_id' à tabela 'quotes'
ALTER TABLE quotes
ADD COLUMN client_id uuid NULL;

-- Opcional: Adicionar uma chave estrangeira para garantir a integridade referencial
-- Isso pressupõe que a tabela 'clients' já existe e tem uma coluna 'id' do tipo uuid.
ALTER TABLE quotes
ADD CONSTRAINT fk_client
FOREIGN KEY (client_id)
REFERENCES clients(id)
ON DELETE SET NULL;