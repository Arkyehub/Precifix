import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart2, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery } from "@tanstack/react-query";
import { MonthlyBilling, MonthlyExpense } from '@/pages/BillingPage';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface AnnualResultSummaryProps {
  year: number;
}

export const AnnualResultSummary = ({ year }: AnnualResultSummaryProps) => {
  const { user } = useSession();
  const { toast } = useToast();

  // Fetch all monthly billing records for the selected year
  const { data: monthlyBillingRecords, isLoading: isLoadingBillingRecords, error: billingRecordsError } = useQuery<MonthlyBilling[]>({
    queryKey: ['annualBillingRecords', user?.id, year],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('monthly_billing')
        .select('*')
        .eq('user_id', user.id)
        .eq('year', year)
        .order('month', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch all monthly expenses for the selected year
  const { data: allMonthlyExpenses, isLoading: isLoadingExpenses, error: expensesError } = useQuery<MonthlyExpense[]>({
    queryKey: ['annualMonthlyExpenses', user?.id, year],
    queryFn: async () => {
      if (!user) return [];
      // First, get all monthly_billing_ids for the selected year
      const { data: billingIds, error: billingIdsError } = await supabase
        .from('monthly_billing')
        .select('id')
        .eq('user_id', user.id)
        .eq('year', year);
      
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
      netRevenue: number;
    }[] = [];

    for (let i = 1; i <= 12; i++) {
      const monthName = format(new Date(year, i - 1, 1), 'MMM', { locale: ptBR });
      const billingRecord = monthlyBillingRecords?.find(b => b.month === i);
      const monthBillingAmount = billingRecord?.billing_amount || 0;

      const monthExpenses = allMonthlyExpenses?.filter(
        exp => exp.monthly_billing_id === billingRecord?.id
      ) || [];
      const monthTotalExpenses = monthExpenses.reduce((sum, exp) => sum + exp.value, 0);

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
  }, [monthlyBillingRecords, allMonthlyExpenses, year]);

  if (isLoadingBillingRecords || isLoadingExpenses) {
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

  if (billingRecordsError || expensesError) {
    toast({
      title: "Erro ao carregar resultados anuais",
      description: billingRecordsError?.message || expensesError?.message,
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