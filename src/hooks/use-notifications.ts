import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useToast } from "@/hooks/use-toast";

export interface Notification {
  id: string;
  user_id: string;
  quote_id: string;
  message: string;
  is_read: boolean;
  type: 'quote_accepted' | 'quote_rejected';
  created_at: string;
}

export const useNotifications = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query para buscar notificações não lidas
  const { data: notifications, isLoading, error } = useQuery<Notification[]>({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    refetchInterval: 30000, // Refetch a cada 30 segundos para verificar novas notificações
  });

  const unreadCount = notifications?.length || 0;

  // Mutação para marcar notificações como lidas
  const markAsReadMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!user) throw new Error("Usuário não autenticado.");
      
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', ids)
        .eq('user_id', user.id); // RLS check
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
    onError: (err) => {
      console.error("Error marking notifications as read:", err);
      toast({
        title: "Erro ao marcar como lido",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const markAllAsRead = () => {
    if (notifications && notifications.length > 0) {
      const ids = notifications.map(n => n.id);
      markAsReadMutation.mutate(ids);
    }
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    markAllAsRead,
    markAsReadMutation,
  };
};