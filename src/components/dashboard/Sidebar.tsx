import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  X, // Para o botão de fechar em mobile
  ChevronDown, // Para o ícone de colapsar
} from 'lucide-react';
import { useSidebar } from './SidebarContext';
import { Button } from '@/components/ui/button'; // Importar Button do shadcn/ui
import { navigationLinks } from '@/lib/navigation'; // Importar os links de navegação
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from '@/lib/utils'; // Importar cn

export const Sidebar = () => {
  const { isSidebarOpen, closeSidebar } = useSidebar();
  const location = useLocation();
  
  // Estado para controlar quais grupos estão abertos
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Efeito para abrir o grupo ativo ao carregar
  useEffect(() => {
    const activeGroup = navigationLinks.find(link => 
      link.type === 'group' && link.sublinks.some(sub => sub.to === location.pathname)
    );
    if (activeGroup && activeGroup.label) {
      setOpenGroups(prev => ({ ...prev, [activeGroup.label]: true }));
    }
  }, [location.pathname]);

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

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
            <img 
              src="/precifix-logo.png" 
              alt="Precifix Logo" 
              className="h-10 w-auto" // Aumentado para h-10
            />
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

        <nav className="flex-1 px-4 py-4 space-y-1"> {/* Reduzido o padding horizontal para 4 */}
          {navigationLinks.map((link) => {
            if (link.type === 'link') {
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={closeSidebar}
                  className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-background text-sidebar-foreground font-bold shadow-sm border-l-4 border-primary pl-[calc(0.75rem-4px)]'
                      : 'text-sidebar-foreground font-normal hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:font-bold'
                  }`}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            }

            if (link.type === 'group') {
              const Icon = link.icon;
              const isOpen = openGroups[link.label] || false;
              const isGroupActive = link.sublinks.some(sub => sub.to === location.pathname);

              return (
                <Collapsible 
                  key={link.label} 
                  open={isOpen} 
                  onOpenChange={() => toggleGroup(link.label)}
                  className="space-y-1"
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn(
                        'w-full justify-start px-3 py-2 text-sm font-medium transition-colors h-auto',
                        isGroupActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-bold'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:font-bold'
                      )}
                    >
                      <Icon className="h-4 w-4 mr-3" />
                      <span className="flex-1 text-left">{link.label}</span>
                      <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen ? 'rotate-180' : 'rotate-0')} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1 pl-4">
                    {link.sublinks.map((sublink) => {
                      const isActive = location.pathname === sublink.to;
                      return (
                        <Link
                          key={sublink.to}
                          to={sublink.to}
                          onClick={closeSidebar}
                          className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                            isActive
                              ? 'bg-background text-sidebar-foreground font-bold shadow-sm border-l-4 border-primary pl-[calc(0.75rem-4px)]'
                              : 'text-sidebar-foreground font-normal hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:font-bold'
                          }`}
                        >
                          <sublink.icon className="h-4 w-4" />
                          {sublink.label}
                        </Link>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              );
            }
            return null;
          })}
        </nav>

        <div className="mt-auto px-6 py-4 border-t border-sidebar-border text-xs text-sidebar-foreground/70">
          <p>&copy; {new Date().getFullYear()} Precifix. Todos os direitos reservados.</p>
        </div>
      </aside>
    </>
  );
};