import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandList, CommandItem } from "@/components/ui/command";
import { Filter, Search, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Sale, PaymentMethod, QuoteStatus, ActiveTextFilter } from '@/hooks/use-sales-data';

interface SalesFilterBarProps {
  allSalesForSuggestions: Sale[]; // Usado para gerar sugestões de filtro
  paymentMethods: PaymentMethod[] | undefined; // Usado para sugestões de método de pagamento
  activeTextFilters: ActiveTextFilter[];
  dateRange: DateRange | undefined;
  onApplyFilters: (filters: { activeTextFilters: ActiveTextFilter[], dateRange: DateRange | undefined }) => void;
  onClearAllFilters: () => void;
}

const statusLabels: Record<QuoteStatus, { label: string | React.ReactNode; color: string }> = {
  closed: { label: 'Atendida', color: 'bg-success/20 text-success' },
  rejected: { label: 'Cancelada', color: 'bg-destructive/20 text-destructive' },
  accepted: { label: 'Aceita', color: 'bg-primary/20 text-primary-strong' },
  pending: { label: 'Em Aberto', color: 'bg-orange-500/20 text-orange-500' },
  awaiting_payment: { label: 'Aguardando Pagamento', color: 'bg-info/20 text-info' },
};

const selectableStatuses: { key: QuoteStatus; label: string }[] = [
  { key: 'closed', label: 'Atendida' },
  { key: 'accepted', label: 'Aceita' },
  { key: 'pending', label: 'Em Aberto' },
  { key: 'rejected', label: 'Cancelada' },
  { key: 'awaiting_payment', label: 'Aguardando Pagamento' },
];

export const SalesFilterBar = ({
  allSalesForSuggestions,
  paymentMethods,
  activeTextFilters,
  dateRange,
  onApplyFilters,
  onClearAllFilters,
}: SalesFilterBarProps) => {
  const [searchFilterType, setSearchFilterType] = useState<'client' | 'saleNumber' | 'status' | 'service' | 'paymentMethod' | 'vehicle'>('client');
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [openCombobox, setOpenCombobox] = useState(false);

  const [openCalendar, setOpenCalendar] = useState(false);
  const [tempDateRange, setTempDateRange] = useState<DateRange | undefined>(dateRange);

  // Internal state for active filters to manage removal
  const [internalActiveTextFilters, setInternalActiveTextFilters] = useState<ActiveTextFilter[]>(activeTextFilters);

  // Sync external activeTextFilters with internal state
  React.useEffect(() => {
    setInternalActiveTextFilters(activeTextFilters);
  }, [activeTextFilters]);

  const handleAddTextFilter = (selectedValue?: string) => {
    const valueToApply = selectedValue || tempSearchTerm;
    if (valueToApply.trim()) {
      const newFilter: ActiveTextFilter = { type: searchFilterType, value: valueToApply.trim() };
      
      // Check for duplicates before adding
      const isDuplicate = internalActiveTextFilters.some(
        f => f.type === newFilter.type && f.value.toLowerCase() === newFilter.value.toLowerCase()
      );

      if (!isDuplicate) {
        const updatedFilters = [...internalActiveTextFilters, newFilter];
        setInternalActiveTextFilters(updatedFilters);
        onApplyFilters({ activeTextFilters: updatedFilters, dateRange });
      }
      setTempSearchTerm('');
    }
  };

  const handleRemoveTextFilter = (indexToRemove: number) => {
    const updatedFilters = internalActiveTextFilters.filter((_, index) => index !== indexToRemove);
    setInternalActiveTextFilters(updatedFilters);
    onApplyFilters({ activeTextFilters: updatedFilters, dateRange });
  };

  const handleApplyDateRange = () => {
    onApplyFilters({ activeTextFilters: internalActiveTextFilters, dateRange: tempDateRange });
    setOpenCalendar(false);
  };

  const handleClearDateRange = () => {
    setTempDateRange(undefined);
    onApplyFilters({ activeTextFilters: internalActiveTextFilters, dateRange: undefined });
    setOpenCalendar(false);
  };

  const handleClearAll = () => {
    setInternalActiveTextFilters([]);
    setTempSearchTerm('');
    setTempDateRange(undefined);
    onClearAllFilters(); // Call the external clear all handler
  };

  const suggestions = useMemo(() => {
    const uniqueValues = new Set<string>();
    const currentSuggestions: { value: string; label: string }[] = [];

    if (!allSalesForSuggestions) return [];

    if (searchFilterType === 'status') {
      return selectableStatuses.map(s => ({ value: s.key, label: s.label.toString() }));
    } else if (searchFilterType === 'paymentMethod') {
      return paymentMethods?.map(pm => ({ value: pm.id, label: pm.name })) || [];
    } else if (searchFilterType === 'client') {
      allSalesForSuggestions.forEach(sale => {
        if (sale.client_name) uniqueValues.add(sale.client_name);
      });
    } else if (searchFilterType === 'saleNumber') {
      allSalesForSuggestions.forEach(sale => {
        if (sale.sale_number) uniqueValues.add(sale.sale_number);
      });
    } else if (searchFilterType === 'service') {
      allSalesForSuggestions.forEach(sale => {
        sale.services_summary?.forEach((service: any) => {
          if (service.name) uniqueValues.add(service.name);
        });
      });
    } else if (searchFilterType === 'vehicle') {
      allSalesForSuggestions.forEach(sale => {
        if (sale.vehicle) uniqueValues.add(sale.vehicle);
      });
    }

    Array.from(uniqueValues).sort().forEach(value => {
      currentSuggestions.push({ value, label: value });
    });

    return currentSuggestions;
  }, [allSalesForSuggestions, searchFilterType, paymentMethods]);

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0">
            <Filter className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48 bg-card">
          <DropdownMenuLabel>Filtrar por:</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setSearchFilterType('client')}>Cliente</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSearchFilterType('saleNumber')}>Nº Venda</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSearchFilterType('status')}>Status</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSearchFilterType('service')}>Serviço</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSearchFilterType('paymentMethod')}>Forma de Pagamento</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSearchFilterType('vehicle')}>Veículo</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={openCombobox}
            className="w-full justify-between text-left font-normal"
          >
            {
              searchFilterType === 'client' ? 'Buscar por cliente' :
              searchFilterType === 'saleNumber' ? 'Buscar por número da venda' :
              searchFilterType === 'status' ? 'Buscar por status' :
              searchFilterType === 'service' ? 'Buscar por serviço' :
              searchFilterType === 'paymentMethod' ? 'Buscar por forma de pagamento' :
              searchFilterType === 'vehicle' ? 'Buscar por veículo' :
              'Buscar...'
            }
            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput
              placeholder={`Buscar por ${searchFilterType === 'client' ? 'cliente' : searchFilterType === 'saleNumber' ? 'número da venda' : searchFilterType === 'status' ? 'status' : searchFilterType === 'service' ? 'serviço' : searchFilterType === 'paymentMethod' ? 'forma de pagamento' : searchFilterType === 'vehicle' ? 'veículo' : '...'}`}
              value={tempSearchTerm}
              onValueChange={setTempSearchTerm}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddTextFilter();
                  setOpenCombobox(false);
                }
              }}
              autoFocus
            />
            <CommandList>
              <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
              <CommandGroup>
                {suggestions
                  .filter(suggestion =>
                    suggestion.label.toLowerCase().includes(tempSearchTerm.toLowerCase())
                  )
                  .map((suggestion) => (
                    <CommandItem
                      key={suggestion.value}
                      value={suggestion.label}
                      onSelect={() => {
                        setTempSearchTerm(suggestion.label);
                        handleAddTextFilter(suggestion.value);
                        setOpenCombobox(false);
                      }}
                    >
                      {suggestion.label}
                    </CommandItem>
                  ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      <Popover open={openCalendar} onOpenChange={setOpenCalendar}>
          <PopoverTrigger asChild>
              <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                      "w-full sm:w-[300px] justify-start text-left font-normal",
                      !dateRange && "text-muted-foreground"
                  )}
                  onClick={() => {
                    setOpenCalendar(true);
                    setTempDateRange(dateRange);
                  }}
              >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                      dateRange.to ? (
                          <>
                              {format(dateRange.from, "dd/MM/yyyy")} -{" "}
                              {format(dateRange.to, "dd/MM/yyyy")}
                          </>
                      ) : (
                          format(dateRange.from, "dd/MM/yyyy")
                      )
                  ) : (
                      <span>Filtrar por data</span>
                  )}
              </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={tempDateRange?.from || new Date()}
                  selected={tempDateRange}
                  onSelect={setTempDateRange}
                  numberOfMonths={2}
              />
              <div className="flex justify-end gap-2 p-2 border-t">
                  <Button 
                      variant="outline" 
                      onClick={handleClearDateRange}
                  >
                      Limpar
                  </Button>
                  <Button 
                      onClick={handleApplyDateRange}
                      disabled={!tempDateRange?.from}
                  >
                      Confirmar
                  </Button>
              </div>
          </PopoverContent>
      </Popover>

      {(internalActiveTextFilters.length > 0 || dateRange?.from) && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground w-full">
          <span className="font-semibold">Filtros Ativos:</span>
          {internalActiveTextFilters.map((filter, index) => (
            <span key={index} className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-primary-strong">
              {filter.type === 'client' ? 'Cliente' :
               filter.type === 'saleNumber' ? 'Nº Venda' :
               filter.type === 'status' ? 'Status' :
               filter.type === 'service' ? 'Serviço' :
               filter.type === 'paymentMethod' ? 'Forma Pagamento' :
               filter.type === 'vehicle' ? 'Veículo' : 'Busca'}: "{filter.value}"
              <button 
                onClick={() => handleRemoveTextFilter(index)} 
                className="ml-1 text-primary-strong/70 hover:text-primary-strong"
                title="Remover busca"
              >
                &times;
              </button>
            </span>
          ))}
          {dateRange?.from && (
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-primary-strong">
              Período: {format(dateRange.from, "dd/MM/yyyy")}
              {dateRange.to && ` - ${format(dateRange.to, "dd/MM/yyyy")}`}
              <button 
                onClick={handleClearDateRange} 
                className="ml-1 text-primary-strong/70 hover:text-primary-strong"
                title="Remover filtro de data"
              >
                &times;
              </button>
            </span>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleClearAll}
            className="text-muted-foreground hover:text-foreground"
          >
            Limpar Todos
          </Button>
        </div>
      )}
    </div>
  );
};