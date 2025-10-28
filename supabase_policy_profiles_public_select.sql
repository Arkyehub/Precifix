-- Habilita RLS na tabela profiles (se ainda não estiver habilitado)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Cria a política para permitir SELECT público (para anon)
-- Permite que qualquer usuário (incluindo anônimos) leia perfis
-- Nota: Esta política é ampla. Se você quiser restringir, use:
-- CREATE POLICY "Allow public read of profiles by user_id"
--   ON profiles FOR SELECT USING (true);
-- Mas para fins de demonstração pública do orçamento, usaremos uma política simples.

CREATE POLICY "Allow public read of profiles"
  ON profiles FOR SELECT USING (true);