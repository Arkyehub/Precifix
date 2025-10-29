import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, FileText, Clock, DollarSign, Tag, Car, Users, MapPin, Mail, Phone, Calendar } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatMinutesToHHMM } from '@/lib/cost-calculations';
import { cn, formatCpfCnpj, formatPhoneNumber, formatCep } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface QuotedService {
  name: string;
  price: number;
  execution_time_minutes: number;
}

interface Quote {
  id: string;
  user_id: string;
  client_id: string | null;
  client_name: string;
  client_document: string | null;
  client_phone: string | null;
  client_email: string | null;
  client_address: string | null;
  client_city: string | null;
  client_state: string | null;
  client_zip_code: string | null;
  vehicle_id: string | null;
  vehicle: string;
  services_summary: QuotedService[];
  products: any[];
  total_price: number;
  status: 'pending' | 'accepted' | 'rejected';
  valid_until: string;
  created_at: string;
  notes: string;
}

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  document_number: string | null;
  phone_number: string | null;
  email: string | null;
  address: string | null;
  address_number: string | null;
  zip_code: string | null;
  city: string | null;
  state: string | null;
  avatar_url: string | null;
}

const QuoteViewPage = () => {
  const { quoteId } = useParams<{ quoteId: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: quote, isLoading: isLoadingQuote, error: quoteError } = useQuery<Quote>({
    queryKey: ['publicQuote', quoteId],
    queryFn: async () => {
      if (!quoteId) throw new Error("ID do orçamento não fornecido.");
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .single();
      if (error) {
        if (error.code === 'PGRST116' || error.code === '42501') {
          throw new Error("Orçamento Não Encontrado.");
        }
        throw error;
      }
      const quoteData = data as unknown as Quote;
      if (data.services_summary) {
        quoteData.services_summary = data.services_summary as QuotedService[];
      } else {
        quoteData.services_summary = [];
      }
      quoteData.products = [];
      return quoteData;
    },
    enabled: !!quoteId,
    retry: false,
  });

  const { data: profile, isLoading: isLoadingProfile, error: profileError } = useQuery<Profile>({
    queryKey: ['publicProfile', quote?.user_id],
    queryFn: async () => {
      if (!quote?.user_id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', quote.user_id)
        .single();
      if (error) {
        console.error("Erro ao buscar perfil:", error);
        return null;
      }
      return { ...data, email: null } as Profile;
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
  const totalQuotePrice = quote.total_price;

  const companyName = profile?.company_name || `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Empresa Não Informada';
  const companyDocument = profile?.document_number ? formatCpfCnpj(profile.document_number) : 'N/A';
  const companyPhone = profile?.phone_number ? formatPhoneNumber(profile.phone_number) : 'N/A';
  
  let companyAddress = 'Endereço Não Informado';
  if (profile?.address) {
    companyAddress = profile.address;
    if (profile.address_number) companyAddress += `, ${profile.address_number}`;
    if (profile.city) companyAddress += ` - ${profile.city}`;
    if (profile.state) companyAddress += `/${profile.state}`;
    if (profile.zip_code) companyAddress += ` (CEP: ${formatCep(profile.zip_code)})`;
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

        <Card className="mb-6 shadow-lg">
          <CardHeader className="border-b p-4">
            <CardTitle className="text-lg flex items-center text-primary">
              <Users className="h-5 w-5 mr-2" />
              Informações da Empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex items-start gap-4 text-sm">
            {isLoadingProfile ? (
              <div className="col-span-2 flex items-center text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando perfil...
              </div>
            ) : profile ? (
              <>
                <Avatar className="h-16 w-16 border">
                  <AvatarImage src={profile.avatar_url || ''} alt={companyName} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                    {companyName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <p className="text-base"><strong>Empresa:</strong> {companyName}</p>
                  <p><strong>CPF/CNPJ:</strong> {companyDocument}</p>
                  <p className="flex items-center">
                    <Phone className="h-4 w-4 mr-1 text-muted-foreground" />
                    <strong>Telefone:</strong> {companyPhone}
                  </p>
                  <p className="flex items-center">
                    <MapPin className="h-4 w-4 mr-1 text-muted-foreground" />
                    <strong>Endereço:</strong> {companyAddress}
                  </p>
                </div>
              </>
            ) : (
              <p className="col-span-2 text-destructive">Não foi possível carregar as informações da empresa.</p>
            )}
          </CardContent>
        </Card>

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
              <div className="pt-2 mt-2 border-t">
                <p className="flex items-center font-medium">
                  <Car className="h-4 w-4 mr-1 text-muted-foreground" />
                  <strong>Veículo:</strong> {quote.vehicle || 'N/A'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader className="border-b p-4">
              <CardTitle className="text-lg flex items-center text-primary">
                <Calendar className="h-5 w-5 mr-2" />
                Agendamento do Serviço
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-sm">
              <p className="text-muted-foreground">Data e hora a combinar.</p>
            </CardContent>
          </Card>
        </div>

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