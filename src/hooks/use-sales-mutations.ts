import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useToast } from "@/hooks/use-toast";
import { QuoteStatus } from "./use-sales-data"; // Importar o tipo de status

export const useSalesMutations = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Mutation para atualizar o status da venda
  const updateSaleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: QuoteStatus }) => {
      if (!user) throw new Error("Usuário não autenticado.");
      const { error } = await supabase
        .from('quotes')
        .update({ status: newStatus })
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closedSales', user?.id] });
      toast({
        title: "Status da venda atualizado!",
        description: "O status da venda foi alterado com sucesso.",
      });
    },
    onError: (err) => {
      console.error("Error updating sale status:", err);
      toast({
        title: "Erro ao atualizar status da venda",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para deletar a venda (SOFT DELETE - muda status para 'deleted')
  const deleteSaleMutation = useMutation({
    mutationFn: async (saleId: string) => {
      if (!user) throw new Error("Usuário não autenticado.");
      
      const { error } = await supabase
        .from('quotes')
        .update({ status: 'deleted' }) // Alterado de delete() para update status
        .eq('id', saleId)
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closedSales', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['scheduledQuotes', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['quotesCount', user?.id] });
      toast({
        title: "Venda excluída!",
        description: "A venda foi marcada como excluída e removida da visualização principal.",
      });
    },
    onError: (err) => {
      console.error("Erro ao excluir venda:", err);
      toast({
        title: "Erro ao excluir venda",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return {
    updateSaleStatusMutation,
    deleteSaleMutation,
  };
};