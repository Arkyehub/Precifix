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
import { useSidebar } from './SidebarContext'; // Importar o contexto da sidebar

export const Header = () => {
  const { user } = useSession();
  const navigate = useNavigate();
  const { toggleSidebar } = useSidebar(); // Usar o toggleSidebar do contexto

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

        {/* Center: App Title (hidden on mobile when sidebar is open) */}
        <Link to="/" className="flex items-center flex-1 lg:flex-none">
          <h1 className="text-2xl font-bold text-foreground">PrecifiCar</h1>
        </Link>

        {/* Right: User Avatar and Dropdown */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end mr-2">
            <p className="text-base font-bold text-foreground">Olá, {userName}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.user_metadata?.avatar_url || ""} alt={user?.email || "User"} />
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
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <UserIcon className="mr-2 h-4 w-4" />
                <span>Meu Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => console.log('Meu Plano')}>
                <CreditCard className="mr-2 h-4 w-4" />
                <span>Meu Plano</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Configurações</span>
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