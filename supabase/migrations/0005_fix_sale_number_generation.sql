-- Atualiza a função para considerar todos os números de venda existentes
CREATE OR REPLACE FUNCTION public.get_next_user_sale_number(p_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  max_number INTEGER;
  next_number TEXT;
BEGIN
  -- Encontra o maior número de venda (ignorando o '#') para este usuário
  -- Removida a verificação 'is_sale = true' para considerar todos os números ocupados
  SELECT MAX(CAST(SUBSTRING(sale_number FROM 2) AS INTEGER))
  INTO max_number
  FROM public.quotes
  WHERE user_id = p_user_id
  AND sale_number ~ '^#\d+$';

  -- Se não houver vendas anteriores, começa do 0
  IF max_number IS NULL THEN
    max_number := 0;
  END IF;

  -- Formata o próximo número com 4 dígitos (ex: #0001)
  next_number := '#' || LPAD((max_number + 1)::TEXT, 4, '0');
  
  RETURN next_number;
END;
$function$;

-- Limpa números de venda de orçamentos que não são vendas (evita conflitos em atualizações futuras)
UPDATE public.quotes 
SET sale_number = NULL 
WHERE is_sale = false 
AND sale_number IS NOT NULL;