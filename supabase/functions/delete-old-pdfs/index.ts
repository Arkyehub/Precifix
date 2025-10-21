/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Cria um cliente Supabase com a Service Role Key
    // Esta chave ignora o Row Level Security (RLS)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const BUCKET_NAME = 'quotes';
    const EXPIRATION_HOURS = 24; // Tempo de validade em horas
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - EXPIRATION_HOURS * 60 * 60 * 1000);

    // Lista todos os itens no bucket (arquivos e "pastas")
    const { data: items, error: listError } = await supabaseClient.storage
      .from(BUCKET_NAME)
      .list('', { limit: 1000, offset: 0 }); // Ajuste o limite se você espera mais de 1000 arquivos

    if (listError) {
      console.error('Erro ao listar itens:', listError);
      return new Response(JSON.stringify({ error: listError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const filesToDelete: string[] = [];
    items.forEach(item => {
      // Processa apenas arquivos reais, não "pastas" (prefixos)
      if (!item.is_stacked) {
        const fileCreatedAt = new Date(item.created_at);
        if (fileCreatedAt < twentyFourHoursAgo) {
          filesToDelete.push(item.name); // item.name contém o caminho completo do arquivo
        }
      }
    });

    if (filesToDelete.length > 0) {
      console.log(`Encontrados ${filesToDelete.length} arquivos para excluir.`);
      const { error: deleteError } = await supabaseClient.storage
        .from(BUCKET_NAME)
        .remove(filesToDelete);

      if (deleteError) {
        console.error('Erro ao excluir arquivos:', deleteError);
        return new Response(JSON.stringify({ error: deleteError.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
      console.log(`Excluídos com sucesso ${filesToDelete.length} arquivos antigos.`);
    } else {
      console.log('Nenhum arquivo antigo encontrado para excluir.');
    }

    return new Response(JSON.stringify({ message: `Limpeza concluída. ${filesToDelete.length} arquivos excluídos.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Erro não tratado:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});