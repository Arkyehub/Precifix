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
      <QuoteGlobalCostsInput
        otherCostsGlobal={otherCostsGlobal}
        onOtherCostsGlobalChange={onOtherCostsGlobalChange}
      />
      <QuoteCommissionSection
        commissionValueInput={commissionValueInput}
        onCommissionValueInputChange={onCommissionValueInputChange}
        onCommissionValueInputBlur={onCommissionValueInputBlur}
        commissionType={commissionType}
        onCommissionTypeChange={onCommissionTypeChange}
        calculatedCommission={calculatedCommission}
      />
    </div>
  );
};