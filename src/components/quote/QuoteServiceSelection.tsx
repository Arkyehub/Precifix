import React from 'react';
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";

interface QuoteServiceSelectionProps {
  serviceOptions: { label: string; value: string }[];
  selectedServiceIds: string[];
  onSelectChange: (ids: string[]) => void;
  existingServiceIds: string[]; // Nova prop para IDs já selecionados
}

export const QuoteServiceSelection = ({
  serviceOptions,
  selectedServiceIds,
  onSelectChange,
  existingServiceIds,
}: QuoteServiceSelectionProps) => {
  
  // Filtra as opções para remover serviços que já estão no orçamento
  const availableOptions = serviceOptions.filter(option => !existingServiceIds.includes(option.value));

  return (
    <div className="space-y-2">
      <Label htmlFor="select-services">Adicionar Serviços *</Label>
      <MultiSelect
        options={availableOptions} // Usar apenas opções disponíveis
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