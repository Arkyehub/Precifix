import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign } from "lucide-react";

interface OperationalCostsProps {
  productsCost: number;
  executionTime: number;
  laborCostPerHour: number;
  otherCosts: number;
  onCostsChange: (costs: {
    executionTime: number;
    laborCostPerHour: number;
    otherCosts: number;
  }) => void;
}

export function OperationalCosts({
  productsCost,
  executionTime,
  laborCostPerHour,
  otherCosts,
  onCostsChange,
}: OperationalCostsProps) {
  const laborCost = (executionTime / 60) * laborCostPerHour;
  const totalCost = productsCost + laborCost + otherCosts;

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-card)] border-border/50">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold text-foreground">Custos Operacionais</h2>
      </div>

      <div className="space-y-4">
        <div className="p-3 bg-primary/10 rounded-lg border border-primary/30">
          <Label className="text-sm text-muted-foreground">Custo de Produtos (calculado)</Label>
          <p className="text-2xl font-bold text-primary">R$ {productsCost.toFixed(2)}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="execution-time" className="text-sm">Tempo de Execução (minutos)</Label>
            <Input
              id="execution-time"
              type="number"
              value={executionTime.toFixed(0) || ""} // Tempo em minutos pode ser inteiro
              onChange={(e) =>
                onCostsChange({
                  executionTime: parseFloat(e.target.value) || 0,
                  laborCostPerHour,
                  otherCosts,
                })
              }
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="labor-cost" className="text-sm">Mão de Obra/Hora (R$)</Label>
            <Input
              id="labor-cost"
              type="number"
              step="0.01"
              value={laborCostPerHour.toFixed(2) || ""}
              onChange={(e) =>
                onCostsChange({
                  executionTime,
                  laborCostPerHour: parseFloat(e.target.value) || 0,
                  otherCosts,
                })
              }
              className="bg-background"
            />
            <p className="text-xs text-muted-foreground">Inclui água, energia e outros custos fixos</p>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="other-costs" className="text-sm">Outros Custos Variáveis (R$)</Label>
            <Input
              id="other-costs"
              type="number"
              step="0.01"
              value={otherCosts.toFixed(2) || ""}
              onChange={(e) =>
                onCostsChange({
                  executionTime,
                  laborCostPerHour,
                  otherCosts: parseFloat(e.target.value) || 0,
                })
              }
              className="bg-background"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-border/50 space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Custo de Mão de Obra:</span>
            <span className="font-medium text-foreground">R$ {laborCost.toFixed(2)}</span>
          </div>
          <div className="p-4 bg-gradient-to-r from-primary/20 to-primary/10 rounded-lg border border-primary/30">
            <div className="flex justify-between items-center">
              <span className="font-medium text-foreground">Custo Total da Operação:</span>
              <span className="text-2xl font-bold text-primary">R$ {totalCost.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}