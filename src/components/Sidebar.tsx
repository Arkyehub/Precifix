import React from 'react';
import { Link } from 'react-router-dom';
import { Car, Package, DollarSign, FileText, Sparkles, Calculator, Settings, User as UserIcon } from 'lucide-react'; // Adicionado Settings e UserIcon
import { Separator } from '@/components/ui/separator';

export const Sidebar = () => {
  return (
    <div className="flex h-full flex-col py-4">
      <div className="mb-6 flex items-center gap-3 px-4">
        <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg shadow-[var(--shadow-elegant)]">
          <Sparkles className="h-6 w-6 text-primary-foreground" />
        </div>
        <h2 className="text-xl font-bold text-foreground">PrecifiCar</h2>
      </div>
      <nav className="grid items-start gap-2 px-4 text-sm font-medium">
        <Link
          to="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
        >
          <Calculator className="h-4 w-4" />
          Calculadora
        </Link>
        <Link
          to="/manage-costs"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
        >
          <DollarSign className="h-4 w-4" />
          Gerenciar Custos
        </Link>
        <Link
          to="/products"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
        >
          <Package className="h-4 w-4" />
          Gerenciar Produtos
        </Link>
        <Link
          to="/services"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
        >
          <Car className="h-4 w-4" />
          Gerenciar Serviços
        </Link>
        <Link
          to="/generate-quote"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
        >
          <FileText className="h-4 w-4" />
          Gerar Orçamento
        </Link>
        <Link
          to="/profile"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
        >
          <UserIcon className="h-4 w-4" />
          Meu Perfil
        </Link>
        <Link
          to="/settings"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
        >
          <Settings className="h-4 w-4" />
          Configurações
        </Link>
      </nav>
      <Separator className="my-4" />
      <div className="px-4 text-xs text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} PrecifiCar. Todos os direitos reservados.</p>
      </div>
    </div>
  );
};