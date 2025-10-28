import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, FileText, Clock, DollarSign, Tag, Car, Users, MapPin, Mail, Phone } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatMinutesToHHMM } from '@/lib/cost-calculations';
import { cn, formatCpfCnpj, formatPhoneNumber } from '@/lib/utils';

// Definindo QuotedService localmente para refletir a estrutura salva em services_summary
interface QuotedService {
  name: string;
  price: number;
  execution_time_minutes: number; // Corrigido para o nome do campo salvo
}

interface Quote {
  id: string;
  user_id: string;
  client_id: string | null;
  client_name: string;
  client_document: string | null; // Novo campo
  client_phone: string | null; // Novo campo
  client_email: string | null; // Novo campo
  client_address: string | null; // Novo campo
  client_city: string | null; // Novo campo
  client_state: string | null; // Novo campo
  client_zip_code: string | null; // Novo campo
  vehicle_id: string | null;
  vehicle: string; // Campo de texto simples para o veículo (Marca Modelo (Placa))
  services_summary: QuotedService[]; // Corrigido para services_summary
  products: any[]; // Mantido como any[] por enquanto
  total_price: number;
  status: 'pending' | 'accepted' | 'rejected';
  valid_until: string;
  created_at: string;
  notes: string;
}

interface Profile {
  id: string;
  first_name: string | null; // Usar first_name
  last_name: string | null; // Usar last_name
  company_name: string | null;
  document_number: string | null; // Adicionado
  phone_number: string | null;
  email: string; // Email vem do auth, mas é bom ter aqui
  address: string | null;
  address_number: string | null; // Adicionado
  zip_code: string | null; // Adicionado
  city: string | null;
  state: string | null;
}

const QuoteViewPage = () => {
  const { quoteId } = useParams<{ quoteId: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 1. Query para buscar o orçamento (acesso público)
  const { data: quote, isLoading: isLoadingQuote, error: quoteError } = useQuery<Quote>({
    queryKey: ['publicQuote', quoteId],
    queryFn: async () => {
      if (!quoteId) throw new Error("ID do orçamento não fornecido.");

      const { data, error } = await supabase
        .from('quotes')
        .select('*, services_summary')
        .eq('id', quoteId)
        .single();

      if (error) {
        if (error.code === 'PGRST116' || error.code === '42501') {
          throw new Error("Orçamento Não Encontrado.");
        }
        throw error;
      }
      
      // Ajustar a estrutura dos dados para corresponder à interface Quote
      const quoteData = data as unknown as Quote;
      
      // Mapeamento dos campos JSONB para as propriedades da interface
      if (data.services_summary) {
        quoteData.services_summary = data.services_summary as QuotedService[];
      } else {
        quoteData.services_summary = [];
      }
      
      // Inicializar products como array vazio, já que não estamos buscando products_summary
      quoteData.products = [];

      return quoteData;
    },
    enabled: !!quoteId,
    retry: false,
  });

  // 2. Query para buscar o perfil do usuário (depende do quote.user_id)
  const { data: profile, isLoading: isLoadingProfile, error: profileError } = useQuery<Profile>({
    queryKey: ['publicProfile', quote?.user_id],
    queryFn: async () => {
      if (!quote?.user_id) return null;

      // Buscar os campos corretos da tabela profiles
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, company_name, document_number, phone_number, address, address_number, zip_code')
        .eq('id', quote.user_id)
        .single();

      if (error) {
        console.error("Erro ao buscar perfil:", error);
        return null;
      }
      
      // Adicionar o email do usuário do auth (se necessário, mas o perfil deve ter os dados de contato)
      const { data: userData } = await supabase.auth.admin.getUserById(quote.user_id);
      const userEmail = userData.user?.email || null;

      // Adicionar campos de cidade/estado/cep/número que não estão no perfil, mas são úteis
      // Nota: O perfil do usuário só tem address, address_number e zip_code. Cidade e Estado não são salvos lá.
      // Vamos usar o que temos e formatar o endereço.
      return { 
        ...data, 
        email: userEmail,
        city: null, // Não temos cidade/estado no perfil
        state: null,
      } as Profile;
    },
    enabled: !!quote?.user_id,
    retry: false,
  });

  if (isLoadingQuote) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Carregando orçamento...</p>
      </div>
    );
  }

  if (quoteError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-4">
        <XCircle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive">Orçamento Não Encontrado</h1>
        <p className="text-muted-foreground mt-2 text-center">
          O link do orçamento pode estar incorreto ou o orçamento foi excluído.
        </p>
        <p className="text-xs text-gray-400 mt-4">Detalhe do erro: {quoteError.message}</p>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-4">
        <XCircle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive">Orçamento Não Encontrado</h1>
        <p className="text-muted-foreground mt-2 text-center">
          O link do orçamento pode estar incorreto ou o orçamento foi excluído.
        </p>
      </div>
    );
  }

  const statusMap = {
    pending: { text: 'Pendente', icon: Clock, color: 'text-yellow-600 bg-yellow-100' },
    accepted: { text: 'Aceito', icon: CheckCircle, color: 'text-green-600 bg-green-100' },
    rejected: { text: 'Rejeitado', icon: XCircle, color: 'text-red-600 bg-red-100' },
  };

  const currentStatus = statusMap[quote.status] || statusMap.pending;
  const totalQuotePrice = quote.total_price; // Usar o total_price salvo

  // Dados da Empresa para exibição
  const companyName = profile?.company_name || `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Empresa Não Informada';
  const companyDocument = profile?.document_number ? formatCpfCnpj(profile.document_number) : 'N/A';
  const companyPhone = profile?.phone_number ? formatPhoneNumber(profile.phone_number) : 'N/A';
  const companyEmail = profile?.email || 'N/A';
  
  let companyAddress = 'Endereço Não Informado';
  if (profile?.address) {
    companyAddress = profile.address;
    if (profile.address_number) companyAddress += `, ${profile.address_number}`;
    if (profile.zip_code) companyAddress += ` (CEP: ${profile.zip_code})`;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 flex justify-between items-start flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 flex items-center">
              <FileText className="h-6 w-6 mr-2 text-primary" />
              Orçamento #{quote.id.substring(0, 8).toUpperCase()}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Emitido em: {format(new Date(quote.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
            </p>
            <p className="text-sm text-muted-foreground">
              Válido até: {format(new Date(quote.valid_until), 'dd/MM/yyyy', { locale: ptBR })}
            </p>
          </div>
          <div className={cn("px-3 py-1 rounded-full text-sm font-semibold", currentStatus.color)}>
            <currentStatus.icon className="h-4 w-4 inline mr-1" />
            {currentStatus.text}
          </div>
        </header>

        {/* Informações da Empresa (Perfil) */}
        <Card className="mb-6 shadow-lg">
          <CardHeader className="border-b p-4">
            <CardTitle className="text-lg flex items-center text-primary">
              <Users className="h-5 w-5 mr-2" />
              Informações da Empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {isLoadingProfile ? (
              <div className="col-span-2 flex items-center text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando perfil...
              </div>
            ) : profile ? (
              <>
                <p className="md:col-span-2"><strong>Empresa:</strong> {companyName}</p>
                <p><strong>CPF/CNPJ:</strong> {companyDocument}</p>
                <p className="flex items-center">
                  <Phone className="h-4 w-4 mr-1 text-muted-foreground" />
                  <strong>Telefone:</strong> {companyPhone}
                </p>
                <p className="flex items-center md:col-span-2">
                  <Mail className="h-4 w-4 mr-1 text-muted-foreground" />
                  <strong>E-mail:</strong> {companyEmail}
                </p>
                <p className="md:col-span-2 flex items-center">
                  <MapPin className="h-4 w-4 mr-1 text-muted-foreground" />
                  <strong>Endereço:</strong> {companyAddress}
                </p>
              </>
            ) : (
              <p className="col-span-2 text-destructive">Não foi possível carregar as informações da empresa.</p>
            )}
          </CardContent>
        </Card>

        {/* Informações do Cliente e Veículo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card className="shadow-lg">
            <CardHeader className="border-b p-4">
              <CardTitle className="text-lg flex items-center text-primary">
                <Users className="h-5 w-5 mr-2" />
                Informações do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-sm">
              <p><strong>Nome:</strong> {quote.client_name}</p>
              <p><strong>CPF/CNPJ:</strong> {quote.client_document ? formatCpfCnpj(quote.client_document) : 'N/A'}</p>
              <p><strong>Telefone:</strong> {quote.client_phone ? formatPhoneNumber(quote.client_phone) : 'N/A'}</p>
              <p><strong>E-mail:</strong> {quote.client_email || 'N/A'}</p>
              <p className="flex items-center">
                <MapPin className="h-4 w-4 mr-1 text-muted-foreground" />
                {quote.client_address || 'N/A'}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader className="border-b p-4">
              <CardTitle className="text-lg flex items-center text-primary">
                <Car className="h-5 w-5 mr-2" />
                Informações do Veículo
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-sm">
              <p><strong>Veículo:</strong> {quote.vehicle || 'N/A'}</p>
            </CardContent>
          </Card>
        </div>

        {/* Detalhes do Orçamento (Serviços e Produtos) */}
        <Card className="mb-6 shadow-lg">
          <CardHeader className="border-b p-4">
            <CardTitle className="text-lg flex items-center text-primary">
              <Tag className="h-5 w-5 mr-2" />
              Itens do Orçamento
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tempo/Qtd</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Preço Unitário</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {quote.services_summary.map((item, index) => (
                    <tr key={`service-${index}`}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">Serviço</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{item.name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-500">
                        {formatMinutesToHHMM(item.execution_time_minutes)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-500">
                        R$ {item.price.toFixed(2).replace('.', ',')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                        R$ {item.price.toFixed(2).replace('.', ',')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td colSpan={4} className="px-4 py-3 text-right text-sm font-bold text-gray-900 uppercase">
                      Total Geral
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-lg font-extrabold text-primary">
                      R$ {totalQuotePrice.toFixed(2).replace('.', ',')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Notas */}
        {quote.notes && (
          <Card className="mb-6 shadow-lg">
            <CardHeader className="border-b p-4">
              <CardTitle className="text-lg flex items-center text-primary">
                <FileText className="h-5 w-5 mr-2" />
                Observações
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 text-sm text-gray-600 whitespace-pre-wrap">
              {quote.notes}
            </CardContent>
          </Card>
        )}

        {/* Ações do Cliente (Aceitar/Rejeitar) */}
        {quote.status === 'pending' && (
          <div className="flex justify-end gap-4 mt-8">
            <Button variant="destructive" className="px-6 py-3 text-lg">
              Rejeitar Orçamento
            </Button>
            <Button className="bg-green-600 hover:bg-green-700 px-6 py-3 text-lg">
              Aceitar Orçamento
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuoteViewPage;