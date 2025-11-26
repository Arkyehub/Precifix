import { createClient } from '@supabase/supabase-js';

// Inicializa o Supabase com Poderes Administrativos (Service Role)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(request, response) {
  // 1. Segurança básica: Aceitar apenas POST
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method not allowed' });
  }

  const payload = request.body;

  // Verifica se o payload chegou (Kiwify envia o objeto direto)
  if (!payload || !payload.order_status) {
    return response.status(400).json({ message: 'Payload inválido' });
  }

  const status = payload.order_status;
  // O Kiwify envia o email dentro do objeto Customer
  const email = payload.Customer?.email; 

  console.log(`Webhook recebido. Status: ${status}, Email: ${email}`);

  try {
    // CENÁRIO 1: COMPRA APROVADA
    if (status === 'paid') {
      // Busca o usuário pelo email na tabela profiles e atualiza o status
      // IMPORTANTE: Sua tabela 'profiles' PRECISA ter a coluna 'email' preenchida
      const { data, error } = await supabase
        .from('profiles')
        .update({ subscription_status: 'pro' })
        .eq('email', email)
        .select();

      if (error) throw error;
      
      console.log(`Usuário ${email} atualizado para PRO.`);
    }

    // CENÁRIO 2: REEMBOLSO (Chargeback ou devolução)
    if (status === 'refunded' || status === 'chargedback') {
      const { error } = await supabase
        .from('profiles')
        .update({ subscription_status: 'free' })
        .eq('email', email);

      if (error) throw error;
      console.log(`Usuário ${email} retornou para FREE (Reembolso).`);
    }

    // Responde para o Kiwify que deu tudo certo (200 OK)
    return response.status(200).json({ received: true });

  } catch (error) {
    console.error('Erro no processamento:', error);
    // Mesmo dando erro interno, respondemos 200 para o Kiwify não ficar tentando reenviar infinitamente se o erro for lógico
    return response.status(200).json({ error: error.message });
  }
}