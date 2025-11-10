import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, CreditCard, Pencil, Trash2, Loader2, Banknote, QrCode } from "lucide-react"; // Importado Banknote e QrCode
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PaymentMethodFormDialog, PaymentMethod, PaymentMethodInstallment } from "@/components/PaymentMethodFormDialog";

const DEFAULT_PAYMENT_METHODS = [
  { name: "Dinheiro", type: "cash", rate: 0.00 },
  { name: "PIX", type: "pix", rate: 0.00 },
  { name: "Cartão de Débito", type: "debit_card", rate: 0.00 }, // Alterado para 0.00%
  { name: "Cartão de Crédito", type: "credit_card", rate: 0.00 }, // Taxa base, parcelas terão taxas específicas
];

const DEFAULT_CREDIT_INSTALLMENTS = Array.from({ length: 12 }, (_, i) => ({
  installments: i + 1,
  rate: 0.00, // Taxa inicial de 0% para todas as parcelas
}));

const PaymentMethodsPage = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethod | undefined>(undefined);
  const hasAddedDefaultPaymentMethodsRef = useRef(false);

  // Fetch payment methods with their installments
  const { data: paymentMethods, isLoading, error } = useQuery<PaymentMethod[]>({
    queryKey: ['paymentMethods', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: methodsData, error: methodsError } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }); // Adicionado ordenação por created_at
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

  const addDefaultPaymentMethodsMutation = useMutation({
    mutationFn: async (userId: string) => {
      const insertedMethods: PaymentMethod[] = [];
      for (const defaultMethod of DEFAULT_PAYMENT_METHODS) {
        const { data: methodData, error: methodError } = await supabase
          .from('payment_methods')
          .insert({ ...defaultMethod, user_id: userId })
          .select()
          .single();
        if (methodError) throw methodError;
        insertedMethods.push(methodData);

        if (methodData.type === 'credit_card') {
          const installmentsToInsert = DEFAULT_CREDIT_INSTALLMENTS.map(inst => ({
            ...inst,
            payment_method_id: methodData.id,
          }));
          const { error: installmentsError } = await supabase
            .from('payment_method_installments')
            .insert(installmentsToInsert);
          if (installmentsError) throw installmentsError;
        }
      }
      return insertedMethods;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentMethods', user?.id] });
      toast({
        title: "Formas de pagamento padrão adicionadas!",
        description: "Você pode editá-las ou adicionar novas.",
      });
    },
    onError: (err) => {
      console.error("Error adding default payment methods:", err);
      toast({
        title: "Erro ao adicionar formas de pagamento padrão",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const shouldAddDefaults =
      user &&
      !isLoading &&
      !error &&
      paymentMethods &&
      paymentMethods.length === 0 &&
      !addDefaultPaymentMethodsMutation.isPending &&
      !hasAddedDefaultPaymentMethodsRef.current;

    if (shouldAddDefaults) {
      hasAddedDefaultPaymentMethodsRef.current = true;
      addDefaultPaymentMethodsMutation.mutate(user.id);
    }
  }, [user, isLoading, error, paymentMethods, addDefaultPaymentMethodsMutation.isPending, addDefaultPaymentMethodsMutation]);

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

  const resetPaymentMethodsMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não autenticado.");

      // 1. Delete all existing payment method installments for the user
      const { error: deleteInstallmentsError } = await supabase
        .from('payment_method_installments')
        .delete()
        .in('payment_method_id', paymentMethods?.map(pm => pm.id) || []); // Delete only for current user's methods
      if (deleteInstallmentsError) {
        console.error("Error deleting existing installments:", deleteInstallmentsError);
        throw deleteInstallmentsError;
      }

      // 2. Delete all existing payment methods for the user
      const { error: deleteMethodsError } = await supabase
        .from('payment_methods')
        .delete()
        .eq('user_id', user.id);
      if (deleteMethodsError) {
        console.error("Error deleting existing payment methods:", deleteMethodsError);
        throw deleteMethodsError;
      }

      // 3. Re-add default payment methods
      await addDefaultPaymentMethodsMutation.mutateAsync(user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentMethods', user?.id] });
      toast({
        title: "Formas de pagamento resetadas!",
        description: "Todas as formas de pagamento foram restauradas para o padrão com taxas zeradas.",
      });
    },
    onError: (err) => {
      console.error("Error resetting payment methods:", err);
      toast({
        title: "Erro ao resetar formas de pagamento",
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

  const handleResetPaymentMethods = () => {
    resetPaymentMethodsMutation.mutate();
  };

  const getPaymentMethodIcon = (type: PaymentMethod['type']) => {
    switch (type) {
      case 'cash':
        return <Banknote className="h-4 w-4 text-muted-foreground" />;
      case 'pix':
        return <QrCode className="h-4 w-4 text-muted-foreground" />;
      case 'debit_card':
      case 'credit_card':
        return <CreditCard className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  if (isLoading || addDefaultPaymentMethodsMutation.isPending || resetPaymentMethodsMutation.isPending) {
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
          <div className="flex items-center justify-between">
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
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive hover:bg-background"
                  title="Resetar para formas de pagamento padrão"
                  disabled={resetPaymentMethodsMutation.isPending}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card">
                <AlertDialogHeader>
                  <AlertDialogTitle>Tem certeza que deseja resetar?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. Todos os seus métodos de pagamento e taxas de parcelamento personalizados serão excluídos e substituídos pelos padrões do sistema (com taxas zeradas).
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={resetPaymentMethodsMutation.isPending}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleResetPaymentMethods} 
                    disabled={resetPaymentMethodsMutation.isPending}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {resetPaymentMethodsMutation.isPending ? "Resetando..." : "Resetar Tudo"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {paymentMethods && paymentMethods.length > 0 ? (
            <div className="space-y-4">
              {paymentMethods.map((method) => (
                <div key={method.id} className="p-4 rounded-lg border bg-background">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      {getPaymentMethodIcon(method.type)} {/* Ícone adicionado aqui */}
                      {method.name}
                    </h4>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditPaymentMethod(method)}
                        className="text-muted-foreground hover:text-primary hover:bg-background"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive hover:bg-background"
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
                      <p>Taxa: {(method.rate ?? 0).toFixed(2)}%</p>
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