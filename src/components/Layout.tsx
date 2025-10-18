import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="grid grid-rows-[auto_1fr] h-screen overflow-hidden"> {/* Main grid for header and content area, now with overflow-hidden */}
      <Header />
      <div className="grid grid-cols-[auto_1fr] flex-1"> {/* Grid for sidebar and main content */}
        {/* Desktop Sidebar */}
        <aside className="hidden w-[250px] shrink-0 border-r border-border/50 bg-sidebar lg:block h-full overflow-y-auto">
          <Sidebar />
        </aside>
        <main className="flex-1 overflow-y-auto"> {/* Main content area with scroll */}
          {children}
        </main>
      </div>
    </div>
  );
};