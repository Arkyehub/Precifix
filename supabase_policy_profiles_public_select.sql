-- Habilita RLS na tabela profiles (se ainda não estiver habilitado)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Cria a política para permitir SELECT público (para anon)
-- Permite que qualquer usuário (incluindo anônimos) leia perfis
CREATE POLICY "Allow public read of profiles"
  ON profiles FOR SELECT USING (true);