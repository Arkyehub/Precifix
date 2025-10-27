import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { SidebarProvider, useSidebar } from './SidebarContext'; // Importar useSidebar
import { cn } from '@/lib/utils'; // Importar cn

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  return (
    <SidebarProvider>
      <LayoutContent>{children}</LayoutContent>
    </SidebarProvider>
  );
};

// Componente separado para consumir o contexto
const LayoutContent = ({ children }: DashboardLayoutProps) => {
  const { isDesktopSidebarCollapsed } = useSidebar();

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar para desktop e mobile (controlada pelo contexto) */}
      <Sidebar />

      <div 
        className={cn(
          "flex flex-col flex-1 w-full overflow-y-auto transition-all duration-200 ease-in-out",
          isDesktopSidebarCollapsed ? "lg:ml-20" : "lg:ml-64" // Ajustar margem com base na largura do menu lateral
        )}
      >
        {/* Header do Dashboard */}
        <Header />

        {/* Conteúdo principal da página */}
        <main className="h-full overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};