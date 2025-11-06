import React from 'react';
import { QuoteGlobalCostsInput } from './QuoteGlobalCostsInput';
import { QuoteCommissionSection } from './QuoteCommissionSection';

interface QuoteCostInputsProps {
  otherCostsGlobal: number;
  onOtherCostsGlobalChange: (value: number) => void;
  commissionValueInput: string;
  onCommissionValueInputChange: (value: string) => void;
  onCommissionValueInputBlur: (value: string) => void;
  commissionType: 'amount' | 'percentage';
  onCommissionTypeChange: (type: 'amount' | 'percentage') => void;
  calculatedCommission: number;
}

export const QuoteCostInputs = ({
  otherCostsGlobal,
  onOtherCostsGlobalChange,
  commissionValueInput,
  onCommissionValueInputChange,
  onCommissionValueInputBlur,
  commissionType,
  onCommissionTypeChange,
  calculatedCommission,
}: QuoteCostInputsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/50">
      <div className="flex flex-col"> {/* Adicionado flex-col para garantir que o conteúdo ocupe o espaço */}
        <QuoteGlobalCostsInput
          otherCostsGlobal={otherCostsGlobal}
          onOtherCostsGlobalChange={onOtherCostsGlobalChange}
        />
      </div>
      <div className="flex flex-col"> {/* Adicionado flex-col para garantir que o conteúdo ocupe o espaço */}
        <QuoteCommissionSection
          commissionValueInput={commissionValueInput}
          onCommissionValueInputChange={onCommissionValueInputChange}
          onCommissionValueInputBlur={onCommissionValueInputBlur}
          commissionType={commissionType}
          onCommissionTypeChange={onCommissionTypeChange}
          calculatedCommission={calculatedCommission}
        />
      </div>
    </div>
  );
};