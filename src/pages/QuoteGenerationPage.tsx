import React from 'react';
import { QuoteCalculator } from "@/components/QuoteCalculator";
import { Gauge } from 'lucide-react'; // Importar o ícone Gauge

const QuoteGenerationPage = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Gauge className="h-6 w-6 text-foreground" />
        <h1 className="text-2xl font-bold text-foreground">PrecifiCar</h1>
      </div>
      <QuoteCalculator />
    </div>
  );
};

export default QuoteGenerationPage;