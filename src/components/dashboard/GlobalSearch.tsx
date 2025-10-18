import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, CreditCard } from 'lucide-react'; // Importar CreditCard
import { Input } from '@/components/ui/input';
import { navigationLinks, userDropdownLinks } from '@/lib/navigation'; // Importar os links de navegação e do dropdown
import { cn } from '@/lib/utils'; // Para usar a função de utilidade de classes

export const GlobalSearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<typeof navigationLinks>([]);
  const [isFocused, setIsFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Combinar todos os links pesquisáveis
  const allSearchableLinks = [
    ...navigationLinks,
    ...userDropdownLinks,
    // Adicione outros links ou itens pesquisáveis aqui, se necessário
    { to: '/my-plan', icon: CreditCard, label: 'Meu Plano' }, // Exemplo de item não presente nos navigationLinks
  ];

  useEffect(() => {
    if (searchTerm.length > 1) {
      const filtered = allSearchableLinks.filter(link =>
        link.label.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setSearchResults(filtered);
    } else {
      setSearchResults([]);
    }
  }, [searchTerm]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleResultClick = (to: string) => {
    navigate(to);
    setSearchTerm('');
    setSearchResults([]);
    setIsFocused(false);
  };

  return (
    <div className="relative flex-1 max-w-md mx-4 hidden lg:block" ref={searchRef}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Buscar..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => setIsFocused(true)}
        className="pl-9 bg-background border-input focus-visible:ring-primary"
      />

      {isFocused && searchResults.length > 0 && (
        <div className="absolute z-50 w-full mt-2 rounded-md border bg-popover shadow-lg">
          <ul className="max-h-60 overflow-y-auto">
            {searchResults.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  onClick={() => handleResultClick(link.to)}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-popover-foreground hover:bg-muted/50 transition-colors"
                >
                  <link.icon className="h-4 w-4 text-muted-foreground" />
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};