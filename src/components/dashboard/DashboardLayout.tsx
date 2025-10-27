import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { SidebarProvider } from './SidebarContext';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  return (
    <SidebarProvider>
      <div className="flex h-screen bg-background">
        {/* Sidebar para desktop e mobile (controlada pelo contexto) */}
        <Sidebar />

        <div className="flex flex-col flex-1 w-full overflow-y-auto">
          {/* Header do Dashboard */}
          <Header />

          {/* Conteúdo principal da página */}
          <main className="h-full overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};