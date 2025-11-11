import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Search, ChevronDown, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

interface AccountsPayableFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: 'all' | 'Paga' | 'Em aberto' | 'Atrasada';
  onStatusFilterChange: (status: 'all' | 'Paga' | 'Em aberto' | 'Atrasada') => void;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

export const AccountsPayableFilterBar: React.FC<AccountsPayableFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  dateRange,
  onDateRangeChange,
}) => {
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  const [tempDateRange, setTempDateRange] = useState<DateRange>({ from: undefined, to: undefined });

  useEffect(() => {
    if (isDatePopoverOpen) {
      setTempDateRange(dateRange);
    }
  }, [isDatePopoverOpen, dateRange]);

  const handleConfirmDateFilter = () => {
    onDateRangeChange(tempDateRange);
    setIsDatePopoverOpen(false);
  };

  const handleClearDateFilter = () => {
    setTempDateRange({ from: undefined, to: undefined });
    onDateRangeChange({ from: undefined, to: undefined });
    setIsDatePopoverOpen(false);
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
      <div className="relative w-full sm:w-1/3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar despesa..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full sm:w-auto">
            Status: {statusFilter === 'all' ? 'Todos' : statusFilter} <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => onStatusFilterChange('all')}>Todos</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onStatusFilterChange('Paga')}>Paga</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onStatusFilterChange('Em aberto')}>Em aberto</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onStatusFilterChange('Atrasada')}>Atrasada</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full sm:w-[300px] justify-start text-left font-normal",
              !dateRange.from && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "LLL dd, y", { locale: ptBR })} -{" "}
                  {format(dateRange.to, "LLL dd, y", { locale: ptBR })}
                </>
              ) : (
                format(dateRange.from, "LLL dd, y", { locale: ptBR })
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
            defaultMonth={tempDateRange.from || dateRange.from}
            selected={tempDateRange}
            onSelect={setTempDateRange}
            numberOfMonths={2}
            locale={ptBR}
          />
          <div className="flex justify-end gap-2 p-2 border-t">
            <Button variant="outline" onClick={handleClearDateFilter}>Limpar</Button>
            <Button onClick={handleConfirmDateFilter}>Confirmar</Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};