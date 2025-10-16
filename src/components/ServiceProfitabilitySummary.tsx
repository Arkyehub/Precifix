import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Percent, BarChart3, Car } from "lucide-react";
import { Service } from "@/components/ServiceFormDialog";
import { calculateProductCost, ProductForCalculation } from '@/lib/cost-calculations';

interface ServiceProfitabilitySummaryProps {
  services: Service[];
}

export const ServiceProfitabilitySummary = ({ services }: ServiceProfitabilitySummaryProps) => {
  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 shadow-[var(--shadow-elegant)]">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg">
            <BarChart3 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-foreground">Demonstrativo de Lucro por Serviço</CardTitle>
            <CardDescription>
              Análise detalhada da rentabilidade de cada serviço oferecido.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {services.length > 0 ? (
          <div className="space-y-4">
            {services.map((service) => {
              const laborCost = (service.execution_time_minutes / 60) * service.labor_cost_per_hour;
              
              let productsCost = 0;
              service.products?.forEach(product => {
                const productForCalc: ProductForCalculation = {
                  gallonPrice: product.price,
                  gallonVolume: product.size * 1000, // Convert liters to ml
                  dilutionRatio: product.dilution_ratio,
                  usagePerVehicle: product.usage_per_vehicle,
                  type: product.type,
                  containerSize: product.container_size,
                };
                productsCost += calculateProductCost(productForCalc);
              });

              const otherCosts = service.other_costs;
              const totalServiceCost = laborCost + productsCost + otherCosts;
              const chargedValue = service.price;
              const netProfit = chargedValue - totalServiceCost;
              const profitMarginPercentage = chargedValue > 0 ? (netProfit / chargedValue) * 100 : 0;

              return (
                <div key={service.id} className="p-4 rounded-lg border bg-background/50">
                  <h4 className="font-semibold text-foreground flex items-center gap-2 mb-3">
                    <Car className="h-4 w-4 text-muted-foreground" />
                    {service.name}
                  </h4>
                  <div className="p-3 rounded-md bg-gradient-to-r from-mediumslateblue/10 to-mediumslateblue/5 border border-mediumslateblue/30">
                    <h5 className="font-semibold text-mediumslateblue mb-2">Detalhes do Lucro</h5>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <span className="text-muted-foreground">Custo Mão de Obra:</span>
                      <span className="text-foreground text-right">R$ {laborCost.toFixed(2)}</span>

                      <span className="text-muted-foreground">Custo Produtos:</span>
                      <span className="text-foreground text-right">R$ {productsCost.toFixed(2)}</span>

                      <span className="text-muted-foreground">Outros Custos:</span>
                      <span className="text-foreground text-right">R$ {otherCosts.toFixed(2)}</span>

                      <div className="col-span-2 border-t border-border/50 my-1"></div>

                      <span className="font-bold text-foreground">Custo Total:</span>
                      <span className="font-bold text-foreground text-right">R$ {totalServiceCost.toFixed(2)}</span>

                      <span className="font-bold text-foreground">Valor Cobrado:</span>
                      <span className="font-bold text-primary text-right text-lg">R$ {chargedValue.toFixed(2)}</span>

                      <div className="col-span-2 border-t border-border/50 my-1"></div>

                      <span className="font-bold text-foreground flex items-center gap-1">
                        <DollarSign className="h-4 w-4 text-success" />
                        Lucro Líquido:
                      </span>
                      <span className="font-bold text-success text-right text-lg">R$ {netProfit.toFixed(2)}</span>

                      <span className="font-bold text-foreground flex items-center gap-1">
                        <Percent className="h-4 w-4 text-success" />
                        Margem de Lucro:
                      </span>
                      <span className="font-bold text-success text-right text-lg">{profitMarginPercentage.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center italic py-4">
            Nenhum serviço cadastrado para exibir o demonstrativo de lucro.
          </p>
        )}
      </CardContent>
    </Card>
  );
};