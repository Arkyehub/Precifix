import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar'; // Importar o Sidebar

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden w-[250px] shrink-0 border-r border-border/50 bg-sidebar lg:block">
          <Sidebar />
        </aside>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
};