import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="grid grid-rows-[auto_1fr] h-screen overflow-hidden"> {/* Main grid for header and content area */}
      <Header />
      <div className="grid grid-cols-[auto_1fr] h-full"> {/* Alterado de flex-1 para h-full para garantir que ocupe a altura total da linha 1fr */}
        {/* Desktop Sidebar */}
        <aside className="hidden w-[250px] shrink-0 border-r border-border/50 bg-sidebar lg:block h-full overflow-y-auto">
          <Sidebar />
        </aside>
        <main className="flex-1 h-full overflow-y-auto"> {/* Main content area with scroll, h-full é crucial */}
          {children}
        </main>
      </div>
    </div>
  );
};