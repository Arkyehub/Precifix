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

  if (!email) {
    return response.status(400).json({ message: 'Email não fornecido no payload' });
  }

  try {
    // BUSCA SEGURA: Recupera o ID do usuário diretamente da tabela auth.users
    const { data: userId, error: userError } = await supabase
      .rpc('get_user_id_by_email', { email_input: email });

    if (userError) {
      console.error('Erro ao buscar usuário:', userError);
      throw userError;
    }

    if (!userId) {
      console.log(`Usuário não encontrado para o email: ${email}`);
      // Respondemos 200 para o Kiwify não reenviar, pois o usuário realmente não existe no nosso banco
      return response.status(200).json({ message: 'Usuário não encontrado' });
    }

    // CENÁRIO 1: COMPRA APROVADA
    if (status === 'paid') {
      const { error } = await supabase
        .from('profiles')
        .update({ subscription_status: 'pro' })
        .eq('id', userId); // Agora atualizamos pelo ID seguro

      if (error) throw error;
      
      console.log(`Usuário ${email} (ID: ${userId}) atualizado para PRO.`);
    }

    // CENÁRIO 2: REEMBOLSO (Chargeback ou devolução)
    if (status === 'refunded' || status === 'chargedback') {
      const { error } = await supabase
        .from('profiles')
        .update({ subscription_status: 'free' })
        .eq('id', userId);

      if (error) throw error;
      console.log(`Usuário ${email} (ID: ${userId}) retornou para FREE (Reembolso).`);
    }

    // Responde para o Kiwify que deu tudo certo (200 OK)
    return response.status(200).json({ received: true });

  } catch (error) {
    console.error('Erro no processamento:', error);
    // Mesmo dando erro interno, respondemos 200 para o Kiwify não ficar tentando reenviar infinitamente se o erro for lógico
    return response.status(200).json({ error: error.message });
  }
}