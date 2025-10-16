import React from 'react';
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { formatMinutesToHHMM } from "@/lib/cost-calculations";
import { QuotedService } from '../QuoteServiceFormDialog'; // Importar a interface

interface QuoteSelectedServicesListProps {
  quotedServices: QuotedService[];
  onEditServiceForQuote: (service: QuotedService) => void;
}

export const QuoteSelectedServicesList = ({
  quotedServices,
  onEditServiceForQuote,
}: QuoteSelectedServicesListProps) => {
  if (quotedServices.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 pt-4 border-t border-border/50">
      <h3 className="text-sm font-medium text-foreground">Serviços Selecionados para Orçamento</h3>
      <div className="grid grid-cols-1 gap-3">
        {quotedServices.map(service => (
          <div key={service.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/50">
            <div className="flex-1">
              <p className="font-medium text-foreground">{service.name}</p>
              <p className="text-xs text-muted-foreground">
                Valor: R$ {(service.quote_price ?? service.price).toFixed(2)} | Tempo: {formatMinutesToHHMM(service.quote_execution_time_minutes ?? service.execution_time_minutes)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEditServiceForQuote(service)}
              className="text-primary hover:bg-primary/10"
              title={`Editar ${service.name} para este orçamento`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};