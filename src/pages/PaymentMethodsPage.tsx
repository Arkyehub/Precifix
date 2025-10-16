import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, CreditCard, Pencil, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PaymentMethodFormDialog, PaymentMethod, PaymentMethodInstallment } from "@/components/PaymentMethodFormDialog";

const PaymentMethodsPage = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethod | undefined>(undefined);

  // Fetch payment methods with their installments
  const { data: paymentMethods, isLoading, error } = useQuery<PaymentMethod[]>({
    queryKey: ['paymentMethods', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: methodsData, error: methodsError } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('user_id', user.id);
      if (methodsError) throw methodsError;

      const methodsWithInstallments = await Promise.all(methodsData.map(async (method) => {
        if (method.type === 'credit_card') {
          const { data: installmentsData, error: installmentsError } = await supabase
            .from('payment_method_installments')
            .select('*')
            .eq('payment_method_id', method.id)
            .order('installments', { ascending: true });
          if (installmentsError) {
            console.error(`Error fetching installments for method ${method.id}:`, installmentsError);
            return { ...method, installments: [] };
          }
          return { ...method, installments: installmentsData };
        }
        return { ...method, installments: [] };
      }));
      return methodsWithInstallments;
    },
    enabled: !!user,
  });

  const deletePaymentMethodMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('payment_methods')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentMethods', user?.id] });
      toast({
        title: "Forma de pagamento removida!",
        description: "A forma de pagamento foi excluída com sucesso.",
      });
    },
    onError: (err) => {
      console.error("Error deleting payment method:", err);
      toast({
        title: "Erro ao remover forma de pagamento",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleAddPaymentMethod = () => {
    setEditingPaymentMethod(undefined);
    setIsFormDialogOpen(true);
  };

  const handleEditPaymentMethod = (method: PaymentMethod) => {
    setEditingPaymentMethod(method);
    setIsFormDialogOpen(true);
  };

  const handleDeletePaymentMethod = (id: string) => {
    deletePaymentMethodMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Carregando formas de pagamento...</p>
      </div>
    );
  }
  if (error) return <p>Erro ao carregar formas de pagamento: {error.message}</p>;

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 shadow-[var(--shadow-elegant)]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg">
              <CreditCard className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-foreground">Gerenciar Formas de Pagamento</CardTitle>
              <CardDescription>
                Adicione e configure as formas de pagamento aceitas em sua estética.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {paymentMethods && paymentMethods.length > 0 ? (
            <div className="space-y-4">
              {paymentMethods.map((method) => (
                <div key={method.id} className="p-4 rounded-lg border bg-background/50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      {method.name}
                    </h4>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditPaymentMethod(method)}
                        className="text-muted-foreground hover:text-primary hover:bg-transparent"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive hover:bg-transparent"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-card">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. Isso excluirá permanentemente a forma de pagamento "{method.name}".
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeletePaymentMethod(method.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground ml-4">
                    <p>Tipo: {method.type === 'cash' ? 'Dinheiro' : method.type === 'pix' ? 'PIX' : method.type === 'debit_card' ? 'Cartão de Débito' : 'Cartão de Crédito'}</p>
                    {method.type !== 'credit_card' && (
                      <p>Taxa: {method.rate.toFixed(2)}%</p>
                    )}
                    {method.type === 'credit_card' && method.installments && method.installments.length > 0 && (
                      <div className="mt-2">
                        <p className="font-medium text-foreground">Taxas de Parcelamento:</p>
                        <ul className="list-disc list-inside">
                          {method.installments.map(inst => (
                            <li key={inst.id}>{inst.installments}x: {inst.rate.toFixed(2)}%</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center italic py-4">
              Nenhuma forma de pagamento cadastrada ainda. Adicione suas formas de pagamento!
            </p>
          )}

          <Button 
            onClick={handleAddPaymentMethod}
            className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Nova Forma de Pagamento
          </Button>
        </CardContent>
      </Card>

      <PaymentMethodFormDialog
        isOpen={isFormDialogOpen}
        onClose={() => setIsFormDialogOpen(false)}
        paymentMethod={editingPaymentMethod}
      />
    </div>
  );
};

export default PaymentMethodsPage;