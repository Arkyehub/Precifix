import React from 'react';
import { Banknote } from 'lucide-react';

export const AccountsPayableHeader: React.FC = () => {
  return (
    <div className="flex items-center gap-2">
      <Banknote className="h-6 w-6 text-primary" />
      <h1 className="text-3xl font-bold">Contas a Pagar</h1>
    </div>
  );
};