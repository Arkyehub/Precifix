import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart2, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery } from "@tanstack/react-query";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Sale } from '@/hooks/use-sales-data';
import { OperationalCostPayment } from '@/types/costs';

interface AnnualResultSummaryProps {
  year: number;
}

// Nova interface para os dados de venda usados especificamente neste componente
interface AnnualSaleData {
  id: string;
  total_price: number;
  created_at: string;
  is_sale: boolean;
  status: string;
}

export const AnnualResultSummary = ({ year }: AnnualResultSummaryProps) => {
  const { user } = useSession();
  const { toast } = useToast();

  // NEW QUERY: Fetch all sales for the selected year
  const { data: annualSales, isLoading: isLoadingSales, error: salesError } = useQuery<AnnualSaleData[]>({
    queryKey: ['annualSales', user?.id, year],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('quotes')
        .select('id, total_price, created_at, is_sale, status') // Selecionar apenas os campos necessários
        .eq('user_id', user.id)
        .eq('is_sale', true)
        .in('status', ['accepted', 'closed']) // Considerar vendas atendidas
        .gte('created_at', format(new Date(year, 0, 1), 'yyyy-MM-dd')) // Início do ano
        .lte('created_at', format(new Date(year, 11, 31), 'yyyy-MM-dd')); // Fim do ano
      if (error) throw error;
      return data as AnnualSaleData[];
    },
    enabled: !!user,
  });

  // NEW QUERY: Fetch all operational cost payments for the selected year
  const { data: annualOperationalCostPayments, isLoading: isLoadingOperationalCostPayments, error: operationalCostPaymentsError } = useQuery<OperationalCostPayment[]>({
    queryKey: ['annualOperationalCostPayments', user?.id, year],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('operational_cost_payments')
        .select('id, due_date, paid_value')
        .eq('user_id', user.id)
        .gte('due_date', format(new Date(year, 0, 1), 'yyyy-MM-dd'))
        .lte('due_date', format(new Date(year, 11, 31), 'yyyy-MM-dd'));
      if (error) throw error;
      return data as OperationalCostPayment[];
    },
    enabled: !!user,
  });

  const annualResults = React.useMemo(() => {
    const results: {
      month: number;
      monthName: string;
      billingAmount: number;
      totalExpenses: number;
      netRevenue: number;
    }[] = [];

    for (let i = 1; i <= 12; i++) {
      const monthName = format(new Date(year, i - 1, 1), 'MMM', { locale: ptBR });
      
      // Calcular faturamento a partir das vendas
      const monthSales = annualSales?.filter(sale => {
        const saleDate = new Date(sale.created_at);
        return saleDate.getMonth() + 1 === i && saleDate.getFullYear() === year;
      }) || [];
      const monthBillingAmount = monthSales.reduce((sum, sale) => sum + sale.total_price, 0);

      // Calcular despesas a partir dos pagamentos de custos operacionais
      const monthExpenses = annualOperationalCostPayments?.filter(payment => {
        const dueDate = new Date(payment.due_date);
        return dueDate.getMonth() + 1 === i && dueDate.getFullYear() === year;
      }) || [];
      const monthTotalExpenses = monthExpenses.reduce((sum, payment) => sum + payment.paid_value, 0);

      const netRevenue = monthBillingAmount - monthTotalExpenses;

      results.push({
        month: i,
        monthName,
        billingAmount: monthBillingAmount,
        totalExpenses: monthTotalExpenses,
        netRevenue,
      });
    }
    return results;
  }, [annualSales, annualOperationalCostPayments, year]);

  if (isLoadingSales || isLoadingOperationalCostPayments) {
    return (
      <Card className="bg-background border-border/50 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <BarChart2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-foreground">Resultado Anual ({year})</CardTitle>
          </div>
          <CardDescription>
            Carregando resultados anuais...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (salesError || operationalCostPaymentsError) {
    toast({
      title: "Erro ao carregar resultados anuais",
      description: salesError?.message || operationalCostPaymentsError?.message,
      variant: "destructive",
    });
    return <p className="text-destructive">Erro ao carregar resultados anuais.</p>;
  }

  return (
    <Card className="bg-background border-border/50 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <BarChart2 className="h-5 w-5 text-primary" />
          <CardTitle className="text-foreground">Resultado Anual ({year})</CardTitle>
        </div>
        <CardDescription>
          Visão geral do faturamento, despesas e receita líquida por mês.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
                <TableHead className="text-right">Despesas</TableHead>
                <TableHead className="text-right">Receita Líquida</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {annualResults.map((result) => (
                <TableRow key={result.month}>
                  <TableCell className="font-medium">{format(new Date(year, result.month - 1, 1), 'MMMM', { locale: ptBR })}</TableCell>
                  <TableCell className="text-right">R$ {result.billingAmount.toFixed(2)}</TableCell>
                  <TableCell className="text-right">R$ {result.totalExpenses.toFixed(2)}</TableCell>
                  <TableCell 
                    className={cn(
                      "text-right font-bold",
                      result.netRevenue >= 0 ? "text-success" : "text-destructive"
                    )}
                  >
                    R$ {result.netRevenue.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};