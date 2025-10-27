import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, FileText, Clock, DollarSign, Tag, Car, Users } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { QuotedService } from '@/components/QuoteServiceFormDialog';
import { formatMinutesToHHMM } from '@/lib/cost-calculations';
import { cn } from '@/lib/utils';

interface Quote {
  id: string;
  client_name: string;
  vehicle: string;
  total_price: number;
  quote_date: string;
  services_summary: QuotedService[];
  observations: string;
  status: 'pending' | 'confirmed' | 'rejected';
  created_at: string;
  // Adicionar campos de perfil para exibição
  profile_company_name: string | null;
  profile_phone_number: string | null;
  profile_address: string | null;
}

const QuoteViewPage = () => {
  const { quoteId } = useParams<{ quoteId: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 1. Query para buscar o orçamento (acesso público)
  const { data: quote, isLoading, error } = useQuery<Quote>({
    queryKey: ['publicQuote', quoteId],
    queryFn: async () => {
      if (!quoteId) throw new Error("ID do orçamento ausente.");
      
      // Nota: Esta query depende de uma política RLS de SELECT pública na tabela 'quotes'
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          profile_company_name:profiles(company_name),
          profile_phone_number:profiles(phone_number),
          profile_address:profiles(address)
        `)
        .eq('id', quoteId)
        .single();

      if (error) throw error;
      
      // Flatten profile data
      const profileCompanyName = Array.isArray(data.profile_company_name) ? data.profile_company_name[0]?.company_name : data.profile_company_name?.company_name;
      const profilePhoneNumber = Array.isArray(data.profile_phone_number) ? data.profile_phone_number[0]?.phone_number : data.profile_phone_number?.phone_number;
      const profileAddress = Array.isArray(data.profile_address) ? data.profile_address[0]?.address : data.profile_address?.address;

      return {
        ...data,
        profile_company_name: profileCompanyName,
        profile_phone_number: profilePhoneNumber,
        profile_address: profileAddress,
      } as Quote;
    },
    enabled: !!quoteId,
  });

  // 2. Mutação para confirmar o orçamento (acesso público)
  const confirmQuoteMutation = useMutation({
    mutationFn: async () => {
      if (!quoteId) throw new Error("ID do orçamento ausente.");
      
      // Nota: Esta mutação depende de uma política RLS de UPDATE pública na tabela 'quotes'
      const { data, error } = await supabase
        .from('quotes')
        .update({ status: 'confirmed' })
        .eq('id', quoteId)
        .eq('status', 'pending') // Garante que só pode confirmar se estiver pendente
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicQuote', quoteId] });
      toast({
        title: "Orçamento Confirmado!",
        description: "Sua confirmação foi registrada. O prestador de serviço será notificado.",
        variant: "default",
      });
    },
    onError: (err) => {
      console.error("Erro ao confirmar orçamento:", err);
      toast({
        title: "Erro na Confirmação",
        description: "Não foi possível confirmar o orçamento. Ele pode já ter sido confirmado ou rejeitado.",
        variant: "destructive",
      });
    },
  });

  const handleConfirm = () => {
    confirmQuoteMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Carregando orçamento...</p>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-xl border-destructive/50 shadow-lg">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle className="text-2xl text-destructive">Orçamento Não Encontrado</CardTitle>
            <CardDescription>
              O link do orçamento pode estar incorreto ou o orçamento foi excluído.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isConfirmed = quote.status === 'confirmed';
  const isRejected = quote.status === 'rejected';
  const quoteDateFormatted = format(new Date(quote.quote_date), 'dd/MM/yyyy', { locale: ptBR });

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <Card className="mx-auto max-w-xl shadow-2xl border-t-8 border-primary">
        <CardHeader className="bg-primary/10 p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold text-primary">Orçamento #{quote.id.substring(0, 8)}</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">Emitido em: {quoteDateFormatted}</CardDescription>
            </div>
            <div className={cn(
              "px-3 py-1 rounded-full font-semibold text-sm",
              isConfirmed ? "bg-success text-success-foreground" :
              isRejected ? "bg-destructive text-destructive-foreground" :
              "bg-primary text-primary-foreground"
            )}>
              {isConfirmed ? 'CONFIRMADO' : isRejected ? 'REJEITADO' : 'PENDENTE'}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          
          {/* Status Section */}
          <div className="p-4 rounded-lg border border-border/50 bg-background shadow-sm">
            <h3 className="font-semibold text-lg mb-3 text-foreground">Informações do Prestador</h3>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Empresa: {quote.profile_company_name || 'N/A'}</p>
              <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Telefone: {quote.profile_phone_number || 'N/A'}</p>
              <p className="flex items-center gap-2"><Tag className="h-4 w-4 text-primary" /> Endereço: {quote.profile_address || 'N/A'}</p>
            </div>
          </div>

          {/* Client & Vehicle */}
          <div className="p-4 rounded-lg border border-border/50 bg-background shadow-sm">
            <h3 className="font-semibold text-lg mb-3 text-foreground">Detalhes do Cliente</h3>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Cliente: {quote.client_name}</p>
              <p className="flex items-center gap-2"><Car className="h-4 w-4 text-primary" /> Veículo: {quote.vehicle}</p>
            </div>
          </div>

          {/* Services Summary */}
          <div className="p-4 rounded-lg border border-border/50 bg-background shadow-sm">
            <h3 className="font-semibold text-lg mb-3 text-foreground">Serviços e Valores</h3>
            <div className="space-y-2">
              {quote.services_summary.map((service, index) => (
                <div key={index} className="flex justify-between items-center border-b border-border/50 pb-2 last:border-b-0">
                  <div className="text-sm">
                    <p className="font-medium text-foreground">{service.name}</p>
                    <p className="text-xs text-muted-foreground">Tempo: {formatMinutesToHHMM(service.execution_time_minutes)}</p>
                  </div>
                  <span className="font-bold text-primary">R$ {service.price.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="pt-4 border-t border-border/50 mt-4 flex justify-between items-center">
              <span className="text-xl font-bold text-foreground">Total:</span>
              <span className="text-3xl font-bold text-success">R$ {quote.total_price.toFixed(2)}</span>
            </div>
          </div>

          {/* Confirmation Button */}
          <div className="pt-4">
            {isConfirmed ? (
              <Button className="w-full bg-success hover:bg-success/90 text-success-foreground" disabled>
                <CheckCircle className="mr-2 h-5 w-5" />
                Orçamento Confirmado!
              </Button>
            ) : isRejected ? (
              <Button className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground" disabled>
                <XCircle className="mr-2 h-5 w-5" />
                Orçamento Rejeitado
              </Button>
            ) : (
              <Button 
                onClick={handleConfirm} 
                className="w-full bg-primary hover:bg-primary-glow text-primary-foreground"
                disabled={confirmQuoteMutation.isPending}
              >
                {confirmQuoteMutation.isPending ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-5 w-5" />
                )}
                Confirmar Orçamento
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QuoteViewPage;