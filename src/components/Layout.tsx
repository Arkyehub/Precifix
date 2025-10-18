import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="flex flex-col h-screen overflow-hidden"> {/* Outer container: flex column, takes full screen height, prevents browser scrollbar */}
      <Header /> {/* Fixed height header */}
      <div className="flex flex-row flex-1"> {/* Content area: flex row, takes remaining vertical height */}
        {/* Desktop Sidebar */}
        <aside className="hidden w-[250px] shrink-0 border-r border-border/50 bg-sidebar lg:block overflow-y-auto"> {/* Sidebar: fixed width, scrolls if content overflows */}
          <Sidebar />
        </aside>
        <main className="flex-1 overflow-y-auto"> {/* Main content: takes remaining width, scrolls if content overflows */}
          {children}
        </main>
      </div>
    </div>
  );
};