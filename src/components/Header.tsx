import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, LogOut, Settings, User as UserIcon, CreditCard, ChevronRight } from 'lucide-react'; // Adicionado CreditCard para 'Meu Plano'
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { Sidebar } from './Sidebar';

export const Header = () => {
  const { user } = useSession();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const getUserInitials = (user: any) => {
    if (!user) return '??';
    const email = user.email || '';
    return email.substring(0, 2).toUpperCase();
  };

  const userName = user?.user_metadata?.first_name || 'Usuário';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-gradient-to-r from-primary/5 to-secondary/5">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Left: Hamburger Menu */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Abrir menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[250px] sm:w-[300px]">
            <Sidebar /> {/* Conteúdo do menu lateral */}
          </SheetContent>
        </Sheet>

        {/* Center: App Title */}
        <Link to="/" className="flex items-center justify-center flex-1 lg:flex-none">
          <h1 className="text-2xl font-bold text-foreground">PrecifiCar</h1>
        </Link>

        {/* Right: User Avatar and Dropdown */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end mr-2">
            <p className="text-sm font-medium text-foreground">Olá, {userName}</p>
            <Link to="/profile" className="text-xs text-muted-foreground hover:text-primary flex items-center">
              Seu Perfil <ChevronRight className="h-3 w-3 ml-1" />
            </Link>
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
                  <p className="text-base font-bold leading-none">{user?.email}</p> {/* E-mail maior e em negrito */}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => console.log('Meu Plano')}>
                <CreditCard className="mr-2 h-4 w-4" />
                <span>Meu Plano</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => console.log('Configurações')}>
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