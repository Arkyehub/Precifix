import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, LogOut, Settings, User as UserIcon, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useSidebar } from './SidebarContext';
import { userDropdownLinks } from '@/lib/navigation'; // Importar os links do dropdown do usuário
import { NotificationBell } from './NotificationBell'; // Importar o novo componente

export const Header = () => {
  const { user } = useSession();
  const navigate = useNavigate();
  const { toggleSidebar } = useSidebar();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const getUserInitials = (user: any) => {
    if (!user) return '??';
    const firstName = user.user_metadata?.first_name || '';
    const lastName = user.user_metadata?.last_name || '';
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }
    return (firstName || user.email || '').substring(0, 2).toUpperCase();
  };

  const userName = user?.user_metadata?.first_name || 'Usuário';

  // Cache-busting para a URL do avatar no cabeçalho
  const headerAvatarUrl = user?.user_metadata?.avatar_url;
  const avatarUpdatedAt = user?.user_metadata?.avatar_updated_at; // Campo que adicionamos
  const finalHeaderAvatarSrc = headerAvatarUrl && avatarUpdatedAt
    ? `${headerAvatarUrl}?t=${new Date(avatarUpdatedAt).getTime()}`
    : headerAvatarUrl;

  return (
    <header className="z-40 py-4 bg-sidebar shadow-md border-b border-border/50">
      <div className="container mx-auto flex items-center justify-between h-full px-6">
        {/* Left: Hamburger Menu for mobile */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="mr-4 lg:hidden text-foreground hover:bg-muted/50"
          aria-label="Abrir menu"
        >
          <Menu className="h-6 w-6" />
        </Button>

        {/* Right: User Avatar and Dropdown */}
        <div className="flex items-center gap-4 ml-auto">
          
          {/* Botão de Notificação */}
          <NotificationBell />

          <div className="flex flex-col items-end mr-2">
            <p className="text-base font-bold text-foreground">Olá, {userName}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full"> {/* Aumentado para h-10 w-10 */}
                <Avatar className="h-10 w-10"> {/* Aumentado para h-10 w-10 */}
                  <AvatarImage src={finalHeaderAvatarSrc || ""} alt={user?.email || "User"} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getUserInitials(user)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-base font-bold leading-none">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {userDropdownLinks.map((link) => (
                <DropdownMenuItem key={link.to} onClick={() => navigate(link.to)}>
                  <link.icon className="mr-2 h-4 w-4" />
                  <span>{link.label}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={() => console.log('Meu Plano')}>
                <CreditCard className="mr-2 h-4 w-4" />
                <span>Meu Plano</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Encerrar Sessão</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};