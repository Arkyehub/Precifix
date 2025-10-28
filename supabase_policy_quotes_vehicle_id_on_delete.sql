-- Altera a chave estrangeira na tabela 'quotes' para a coluna 'vehicle_id'
-- para garantir que, se um veículo for excluído da tabela 'client_vehicles',
-- o campo 'vehicle_id' na tabela 'quotes' seja definido como NULL,
-- em vez de bloquear a exclusão (ON DELETE RESTRICT).

-- 1. Remove a chave estrangeira existente (se existir)
ALTER TABLE public.quotes
DROP CONSTRAINT IF EXISTS quotes_vehicle_id_fkey;

-- 2. Adiciona a nova chave estrangeira com ON DELETE SET NULL
ALTER TABLE public.quotes
ADD CONSTRAINT quotes_vehicle_id_fkey
FOREIGN KEY (vehicle_id)
REFERENCES public.client_vehicles(id)
ON DELETE SET NULL;