import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  X, // Para o botão de fechar em mobile
  Gauge, // Alterado de LayoutDashboard para Gauge
  FolderOpen, // Import FolderOpen icon
  Menu, // Importar o ícone de menu
} from 'lucide-react';
import { useSidebar } from './SidebarContext';
import { Button } from '@/components/ui/button'; // Importar Button do shadcn/ui
import { navigationLinks } from '@/lib/navigation'; // Importar os links de navegação
import { cn } from '@/lib/utils'; // Import cn para conditional classNames
import { useIsMobile } from '@/hooks/use-mobile'; // Import useIsMobile

export const Sidebar = () => {
  const { isMobileSidebarOpen, closeMobileSidebar, isDesktopSidebarCollapsed, toggleDesktopSidebar } = useSidebar(); // Usar os novos valores do contexto
  const location = useLocation();
  const isMobile = useIsMobile(); // Determinar se está em dispositivo móvel

  return (
    <>
      {/* Overlay para mobile */}
      {isMobileSidebarOpen && (
        <div
          onClick={closeMobileSidebar}
          className="fixed inset-0 z-20 bg-black opacity-50 lg:hidden"
        ></div>
      )}

      {/* Sidebar principal */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 overflow-y-auto bg-sidebar transition-all duration-200 ease-in-out flex flex-col",
          // Estilos para mobile
          "lg:static", // Em telas grandes, é estático
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full', // Desliza para dentro/fora em mobile
          "lg:translate-x-0", // Sempre visível no desktop
          // Estilos para desktop
          isDesktopSidebarCollapsed ? "lg:w-20" : "lg:w-64" // Largura recolhida ou total
        )}
      >
        <div className="flex items-center justify-between px-6 py-4">
          {/* Botão de menu para desktop - visível apenas em desktop */}
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDesktopSidebar}
              className="text-sidebar-foreground hover:bg-sidebar-accent"
              aria-label="Recolher/Expandir menu"
            >
              <Menu className="h-6 w-6" />
            </Button>
          )}

          {/* Logo e texto - ocultar quando o menu lateral estiver recolhido no desktop */}
          {!isDesktopSidebarCollapsed && (
            <Link to="/" className="flex items-center gap-3 ml-4" onClick={closeMobileSidebar}>
              <img
                src="/precifix-logo.png"
                alt="Precifix Logo"
                className="h-10 w-auto transition-all duration-200"
              />
              <span className="text-xl font-bold text-sidebar-foreground whitespace-nowrap">Precifix</span>
            </Link>
          )}

          {/* Botão de fechar para mobile (X) - visível apenas em mobile quando o menu está aberto */}
          {isMobile && isMobileSidebarOpen && (
            <Button
              variant="ghost"
              size="icon"
              onClick={closeMobileSidebar}
              className="text-sidebar-foreground hover:bg-sidebar-accent"
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-2"> {/* Ajustado px para 3 para o estado recolhido */}
          {navigationLinks.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={closeMobileSidebar}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? 'bg-background text-sidebar-foreground font-bold shadow-sm border-l-4 border-primary pl-[calc(0.75rem-4px)]'
                    : 'text-sidebar-foreground font-normal hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:font-bold',
                  isDesktopSidebarCollapsed && "justify-center px-2" // Centralizar ícone quando recolhido
                )}
              >
                <link.icon className="h-4 w-4" />
                {!isDesktopSidebarCollapsed && ( // Ocultar rótulo quando recolhido
                  <span className="whitespace-nowrap">{link.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className={cn(
          "mt-auto px-6 py-4 border-t border-sidebar-border text-xs text-sidebar-foreground/70",
          isDesktopSidebarCollapsed && "lg:px-2 lg:text-center" // Centralizar texto quando recolhido
        )}>
          {!isDesktopSidebarCollapsed && ( // Ocultar texto quando recolhido
            <p>&copy; {new Date().getFullYear()} Precifix. Todos os direitos reservados.</p>
          )}
        </div>
      </aside>
    </>
  );
};