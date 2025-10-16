import React from 'react';
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";

interface QuoteServiceSelectionProps {
  serviceOptions: { label: string; value: string }[];
  selectedServiceIds: string[];
  onSelectChange: (ids: string[]) => void;
}

export const QuoteServiceSelection = ({
  serviceOptions,
  selectedServiceIds,
  onSelectChange,
}: QuoteServiceSelectionProps) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="select-services">Adicionar Serviços *</Label>
      <MultiSelect
        options={serviceOptions}
        selected={selectedServiceIds}
        onSelectChange={onSelectChange}
        placeholder="Selecione os serviços para o orçamento"
      />
      {selectedServiceIds.length === 0 && (
        <p className="text-sm text-destructive mt-2">Por favor, selecione pelo menos um serviço.</p>
      )}
    </div>
  );
};