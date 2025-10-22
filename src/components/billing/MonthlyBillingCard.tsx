import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DollarSign, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MonthlyBilling } from '@/pages/BillingPage';

interface MonthlyBillingCardProps {
  monthlyBilling: MonthlyBilling | undefined;
  month: number;
  year: number;
}

export const MonthlyBillingCard = ({ monthlyBilling, month, year }: MonthlyBillingCardProps) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [billingAmount, setBillingAmount] = useState(monthlyBilling?.billing_amount.toFixed(2) || '');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setBillingAmount(monthlyBilling?.billing_amount.toFixed(2) || '');
    setIsEditing(false); // Reset editing state when month/year or monthlyBilling changes
  }, [monthlyBilling, month, year]);

  const upsertMonthlyBillingMutation = useMutation({
    mutationFn: async (data: { month: number; year: number; billing_amount: number; id?: string }) => {
      if (!user) throw new Error("Usuário não autenticado.");

      if (data.id) {
        // Update existing record
        const { data: updatedData, error } = await supabase
          .from('monthly_billing')
          .update({ billing_amount: data.billing_amount })
          .eq('id', data.id)
          .eq('user_id', user.id)
          .select()
          .single();
        if (error) throw error;
        return updatedData;
      } else {
        // Insert new record
        const { data: insertedData, error } = await supabase
          .from('monthly_billing')
          .insert({
            user_id: user.id,
            month: data.month,
            year: data.year,
            billing_amount: data.billing_amount,
          })
          .select()
          .single();
        if (error) throw error;
        return insertedData;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['monthlyBillingRecords', user?.id] });
      toast({
        title: "Faturamento mensal salvo!",
        description: `Faturamento de R$ ${data.billing_amount.toFixed(2)} para ${month}/${year} foi atualizado.`,
      });
      setIsEditing(false);
    },
    onError: (err) => {
      toast({
        title: "Erro ao salvar faturamento",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const parsedAmount = parseFloat(billingAmount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      toast({
        title: "Valor inválido",
        description: "Por favor, insira um valor de faturamento válido.",
        variant: "destructive",
      });
      return;
    }

    upsertMonthlyBillingMutation.mutate({
      id: monthlyBilling?.id,
      month,
      year,
      billing_amount: parsedAmount,
    });
  };

  return (
    <Card className="bg-background border-border/50 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <DollarSign className="h-5 w-5 text-primary" />
          <CardTitle className="text-foreground">Faturamento Mensal</CardTitle>
        </div>
        <CardDescription>
          Registre o valor total faturado neste mês.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="billing-amount">Valor Faturado (R$)</Label>
            <Input
              id="billing-amount"
              type="text"
              step="0.01"
              value={billingAmount.replace('.', ',')}
              onChange={(e) => setBillingAmount(e.target.value.replace(',', '.'))}
              onFocus={() => setIsEditing(true)}
              className="bg-background text-lg font-semibold"
              placeholder="0,00"
            />
          </div>
          {isEditing && (
            <Button
              onClick={handleSave}
              className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
              disabled={upsertMonthlyBillingMutation.isPending}
            >
              {upsertMonthlyBillingMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Salvar Faturamento"
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};