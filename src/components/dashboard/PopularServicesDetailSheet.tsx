import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ServiceData } from './PopularServicesChart'; // Importar a interface ServiceData
import { cn } from '@/lib/utils';

interface PopularServicesDetailSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  popularServices: ServiceData[];
  totalServicesCount: number;
  selectedDate: Date;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF19B8'];

export const PopularServicesDetailSheet = ({
  isOpen,
  onOpenChange,
  popularServices,
  totalServicesCount,
  selectedDate,
}: PopularServicesDetailSheetProps) => {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Detalhes dos Serviços Populares</SheetTitle>
          <SheetDescription>
            Lista detalhada dos serviços mais concluídos em {format(selectedDate, 'MMMM yyyy', { locale: ptBR })}.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-120px)] py-4">
          <div className="space-y-4">
            {popularServices.length > 0 ? (
              popularServices.map((service, index) => {
                const percentage = totalServicesCount > 0 ? (service.count / totalServicesCount * 100).toFixed(1) : 0;
                const color = COLORS[index % COLORS.length];
                return (
                  <div key={service.name} className="flex items-center justify-between p-3 border rounded-md">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></span>
                      <span className="font-medium text-foreground">{service.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{service.count}</span>
                      <span className="font-semibold" style={{ color: color }}>{percentage}%</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-center text-muted-foreground italic">Nenhum serviço concluído neste mês.</p>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};