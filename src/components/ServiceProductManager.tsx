import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Package, Car } from "lucide-react";
import { Service } from "@/components/ServiceFormDialog"; // Assumindo que Service type é exportado

interface ServiceProductManagerProps {
  services: Service[];
  onAddProductToService: (service: Service) => void;
}

export const ServiceProductManager = ({ services, onAddProductToService }: ServiceProductManagerProps) => {
  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 shadow-[var(--shadow-elegant)]">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg">
            <Package className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-foreground">Produtos Utilizados nos Serviços</CardTitle>
            <CardDescription>
              Visualize e adicione produtos do seu catálogo a cada serviço.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {services.length > 0 ? (
          <div className="space-y-4">
            {services.map((service) => (
              <div key={service.id} className="p-4 rounded-lg border bg-background/50">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <Car className="h-4 w-4 text-muted-foreground" />
                    {service.name}
                  </h4>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onAddProductToService(service)}
                    className="text-primary hover:bg-primary/10"
                    title={`Adicionar produtos a ${service.name}`}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {service.products && service.products.length > 0 ? (
                  <ul className="list-disc list-inside text-sm text-muted-foreground ml-4 space-y-1">
                    {service.products.map(product => (
                      <li key={product.id}>{product.name}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic ml-4">Nenhum produto vinculado.</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center italic py-4">
            Nenhum serviço cadastrado para vincular produtos.
          </p>
        )}
      </CardContent>
    </Card>
  );
};