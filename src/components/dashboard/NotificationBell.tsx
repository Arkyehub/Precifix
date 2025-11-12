import React from 'react';
import { Bell, Loader2, CheckCircle, XCircle, FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications, Notification } from '@/hooks/use-notifications';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'quote_accepted':
      return <CheckCircle className="h-4 w-4 text-success" />;
    case 'quote_rejected':
      return <XCircle className="h-4 w-4 text-destructive" />;
    case 'expense_due_today': // Novo tipo
      return <Bell className="h-4 w-4 text-yellow-500" />; // Ícone para despesa vencendo hoje
    case 'expense_overdue': // Novo tipo
      return <Trash2 className="h-4 w-4 text-red-500" />; // Ícone para despesa atrasada
    default:
      return <FileText className="h-4 w-4 text-primary" />;
  }
};

export const NotificationBell = () => {
  const { notifications, unreadCount, isLoading, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  const handleNotificationClick = (notification: Notification) => {
    // Marcar todas como lidas ao abrir o dropdown e clicar em uma
    markAllAsRead();

    // Navegar para a página apropriada com base no tipo de notificação
    if (notification.type === 'quote_accepted' || notification.type === 'quote_rejected') {
      if (notification.quote_id) {
        navigate(`/agenda`); // Redireciona para a agenda, onde o usuário pode ver o status do orçamento
      }
    } else if (notification.type === 'expense_due_today' || notification.type === 'expense_overdue') {
      navigate(`/accounts-payable`); // Redireciona para a página de contas a pagar
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-foreground hover:bg-muted/50">
          <Bell className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-3 w-3 items-center justify-center rounded-full bg-destructive text-xs font-bold text-white">
              {/* Não exibimos o número, apenas o ponto vermelho */}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 bg-card" align="end" forceMount>
        <DropdownMenuLabel className="font-bold flex items-center justify-between">
          Notificações ({unreadCount})
          {unreadCount > 0 && (
            <Button 
              variant="link" 
              size="sm" 
              onClick={markAllAsRead}
              className="text-xs text-primary h-6 p-0"
              disabled={isLoading}
            >
              Marcar todas como lidas
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {isLoading ? (
          <div className="flex justify-center items-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : notifications && notifications.length > 0 ? (
          <ScrollArea className="h-64">
            <div className="space-y-1 p-1">
              {notifications.map((notification) => (
                <DropdownMenuItem 
                  key={notification.id} 
                  onClick={() => handleNotificationClick(notification)}
                  className="flex flex-col items-start p-2 cursor-pointer hover:bg-muted/50 transition-colors h-auto"
                >
                  <div className="flex items-center gap-2 w-full">
                    {getNotificationIcon(notification.type)}
                    <p className="text-sm font-medium flex-1 whitespace-normal leading-tight">
                      {notification.message}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 ml-6">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </DropdownMenuItem>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma notificação não lida.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};