import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart } from "lucide-react";
import { QuoteCalculator } from "@/components/QuoteCalculator"; // Reutilizando o componente principal de cálculo

const NewSalePage = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 shadow-[var(--shadow-elegant)] mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg">
              <ShoppingCart className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-foreground">Lançar Nova Venda</CardTitle>
              <CardDescription>
                Calcule os custos, defina o preço e registre uma venda finalizada.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Reutilizamos o QuoteCalculator, mas ele será usado para lançar uma venda final */}
          <QuoteCalculator isSale={true} /> 
        </CardContent>
      </Card>
    </div>
  );
};

export default NewSalePage;