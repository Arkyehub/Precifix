import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart2, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery } from "@tanstack/react-query";
import { MonthlyBilling, MonthlyExpense } from '@/pages/BillingPage'; // Reutilizar interfaces
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DashboardAnnualSummaryProps {
  year?: number; // Opcional, se não for passado, usará o ano atual
}

export const DashboardAnnualSummary = ({ year: propYear }: DashboardAnnualSummaryProps) => {
  const { user } = useSession();
  const { toast } = useToast();
  const currentYear = propYear || new Date().getFullYear();

  // Fetch all monthly billing records for the selected year
  const { data: monthlyBillingRecords, isLoading: isLoadingBillingRecords, error: billingRecordsError } = useQuery<MonthlyBilling[]>({
    queryKey: ['dashboardAnnualBillingRecords', user?.id, currentYear],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('monthly_billing')
        .select('*')
        .eq('user_id', user.id)
        .eq('year', currentYear)
        .order('month', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch all monthly expenses for the selected year
  const { data: allMonthlyExpenses, isLoading: isLoadingExpenses, error: expensesError } = useQuery<MonthlyExpense[]>({
    queryKey: ['dashboardAnnualMonthlyExpenses', user?.id, currentYear],
    queryFn: async () => {
      if (!user) return [];
      // First, get all monthly_billing_ids for the selected year
      const { data: billingIds, error: billingIdsError } = await supabase
        .from('monthly_billing')
        .select('id')
        .eq('user_id', user.id)
        .eq('year', currentYear);
      
      if (billingIdsError) throw billingIdsError;
      const ids = billingIds.map(b => b.id);

      if (ids.length === 0) return [];

      // Then, fetch all expenses associated with those billing_ids
      const { data, error } = await supabase
        .from('monthly_expenses')
        .select('*')
        .in('monthly_billing_id', ids);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const annualResults = React.useMemo(() => {
    const results: {
      month: number;
      monthName: string;
      billingAmount: number;
      totalExpenses: number;
      netRevenue: number; // Lucro em R$
      profitPercentage: number; // Lucro em %
    }[] = [];

    for (let i = 1; i <= 12; i++) {
      const monthName = format(new Date(currentYear, i - 1, 1), 'MMM', { locale: ptBR });
      const billingRecord = monthlyBillingRecords?.find(b => b.month === i);
      const monthBillingAmount = billingRecord?.billing_amount || 0;

      const monthExpenses = allMonthlyExpenses?.filter(
        exp => exp.monthly_billing_id === billingRecord?.id
      ) || [];
      const monthTotalExpenses = monthExpenses.reduce((sum, exp) => sum + exp.value, 0);

      const netRevenue = monthBillingAmount - monthTotalExpenses;
      const profitPercentage = monthBillingAmount > 0 ? (netRevenue / monthBillingAmount) * 100 : 0;

      results.push({
        month: i,
        monthName,
        billingAmount: monthBillingAmount,
        totalExpenses: monthTotalExpenses,
        netRevenue,
        profitPercentage,
      });
    }
    return results;
  }, [monthlyBillingRecords, allMonthlyExpenses, currentYear]);

  if (isLoadingBillingRecords || isLoadingExpenses) {
    return (
      <Card className="bg-background border-border/50 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <BarChart2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-foreground">Resultado Anual ({currentYear})</CardTitle>
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

  if (billingRecordsError || expensesError) {
    toast({
      title: "Erro ao carregar resultados anuais",
      description: billingRecordsError?.message || expensesError?.message,
      variant: "destructive",
    });
    return <p className="text-destructive">Erro ao carregar resultados anuais.</p>;
  }

  return (
    <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <BarChart2 className="h-5 w-5 text-primary" />
          <CardTitle className="text-foreground">Resultado Anual ({currentYear})</CardTitle>
        </div>
        <CardDescription>
          Visão geral do faturamento, despesas, lucro e margem de lucro por mês.
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
                <TableHead className="text-right">Lucro (R$)</TableHead>
                <TableHead className="text-right">Lucro (%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {annualResults.map((result) => (
                <TableRow key={result.month}>
                  <TableCell className="font-medium">{format(new Date(currentYear, result.month - 1, 1), 'MMMM', { locale: ptBR })}</TableCell>
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
                  <TableCell 
                    className={cn(
                      "text-right font-bold",
                      result.profitPercentage >= 0 ? "text-success" : "text-destructive"
                    )}
                  >
                    {result.profitPercentage.toFixed(1)}%
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