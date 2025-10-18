import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Calculator,
  DollarSign,
  Package,
  Car,
  CreditCard,
  FileText,
  User as UserIcon,
  Settings,
  X, // Para o botão de fechar em mobile
  Sparkles, // Re-adicionado Sparkles
} from 'lucide-react';
import { useSidebar } from './SidebarContext';
import { Button } from '@/components/ui/button'; // Importar Button do shadcn/ui

const navigationLinks = [
  { to: '/', icon: Calculator, label: 'Calculadora' },
  { to: '/manage-costs', icon: DollarSign, label: 'Gerenciar Custos' },
  { to: '/products', icon: Package, label: 'Gerenciar Produtos' },
  { to: '/services', icon: Car, label: 'Gerenciar Serviços' },
  { to: '/payment-methods', icon: CreditCard, label: 'Gerenciar Pagamentos' },
  { to: '/generate-quote', icon: FileText, label: 'Gerar Orçamento' },
  { to: '/profile', icon: UserIcon, label: 'Meu Perfil' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
];

export const Sidebar = () => {
  const { isSidebarOpen, closeSidebar } = useSidebar();
  const location = useLocation();

  return (
    <>
      {/* Overlay para mobile */}
      {isSidebarOpen && (
        <div
          onClick={closeSidebar}
          className="fixed inset-0 z-20 bg-black opacity-50 lg:hidden"
        ></div>
      )}

      {/* Sidebar principal */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 overflow-y-auto bg-sidebar transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } flex flex-col`}
      >
        <div className="flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3" onClick={closeSidebar}>
            <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg shadow-[var(--shadow-elegant)]">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
            <h2 className="text-xl font-bold text-sidebar-foreground">PrecifiCar</h2>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={closeSidebar}
            className="lg:hidden text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 px-6 py-4 space-y-2">
          {navigationLinks.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={closeSidebar}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto px-6 py-4 border-t border-sidebar-border text-xs text-sidebar-foreground/70">
          <p>&copy; {new Date().getFullYear()} PrecifiCar. Todos os direitos reservados.</p>
        </div>
      </aside>
    </>
  );
};