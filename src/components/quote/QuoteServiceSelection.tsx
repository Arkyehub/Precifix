import React from 'react';
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";

interface QuoteServiceSelectionProps {
  serviceOptions: { label: string; value: string }[];
  selectedServiceIds: string[];
  onSelectChange: (ids: string[]) => void;
  existingServiceIds: string[]; // Mantido, mas não usado para filtrar opções
}

export const QuoteServiceSelection = ({
  serviceOptions,
  selectedServiceIds,
  onSelectChange,
  existingServiceIds,
}: QuoteServiceSelectionProps) => {
  
  // Usar todas as opções para permitir a duplicação
  const availableOptions = serviceOptions;

  return (
    <div className="space-y-2">
      <Label htmlFor="select-services">Adicionar Serviços *</Label>
      <MultiSelect
        options={availableOptions} // Usar todas as opções
        selected={selectedServiceIds} // Deve ser vazio ou o ID que acabou de ser selecionado
        onSelectChange={onSelectChange}
        placeholder="Selecione os serviços para o orçamento"
      />
      {existingServiceIds.length === 0 && (
        <p className="text-sm text-destructive mt-2">Por favor, selecione pelo menos um serviço.</p>
      )}
    </div>
  );
};