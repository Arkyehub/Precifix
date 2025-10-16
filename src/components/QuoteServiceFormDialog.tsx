import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { LoadHourlyCostButton } from './LoadHourlyCostButton';
import { formatMinutesToHHMM, parseHHMMToMinutes, calculateProductCost, ProductForCalculation } from '@/lib/cost-calculations';
import { Package, Pencil, Trash2, DollarSign, Clock, Receipt } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { formatDilutionRatio } from '@/lib/cost-calculations';

// Reutilizando a interface Service, mas adicionando campos para overrides específicos do orçamento
export interface QuotedService {
  id: string;
  name: string;
  description?: string;
  price: number; // Valor original do serviço
  labor_cost_per_hour: number; // Custo original da mão de obra
  execution_time_minutes: number; // Tempo original de execução
  other_costs: number; // Outros custos originais
  user_id: string;
  products?: {
    id: string;
    name: string;
    size: number; // em litros
    price: number; // em R$
    type: 'diluted' | 'ready-to-use';
    dilution_ratio: number;
    usage_per_vehicle: number;
    container_size: number;
  }[];

  // Campos para overrides específicos do orçamento
  quote_price?: number;
  quote_labor_cost_per_hour?: number;
  quote_execution_time_minutes?: number;
  quote_other_costs?: number;
  quote_products?: { // Produtos específicos para este orçamento, potencialmente modificados
    id: string;
    name: string;
    size: number;
    price: number;
    type: 'diluted' | 'ready-to-use';
    dilution_ratio: number;
    usage_per_vehicle: number;
    container_size: number;
  }[];
}

interface QuoteServiceFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  service: QuotedService; // O serviço a ser editado para o orçamento
  onSave: (updatedService: QuotedService) => void;
  productCostCalculationMethod: 'per-service' | 'monthly-average';
}

export const QuoteServiceFormDialog = ({ isOpen, onClose, service, onSave, productCostCalculationMethod }: QuoteServiceFormDialogProps) => {
  const { toast } = useToast();

  // Estados locais para os valores que podem ser sobrescritos no orçamento
  const [quotePrice, setQuotePrice] = useState(service.quote_price?.toFixed(2) || service.price.toFixed(2));
  const [quoteLaborCostPerHour, setQuoteLaborCostPerHour] = useState(service.quote_labor_cost_per_hour?.toFixed(2) || service.labor_cost_per_hour.toFixed(2));
  const [quoteExecutionTimeHHMM, setQuoteExecutionTimeHHMM] = useState(formatMinutesToHHMM(service.quote_execution_time_minutes || service.execution_time_minutes));
  const [quoteOtherCosts, setQuoteOtherCosts] = useState(service.quote_other_costs?.toFixed(2) || service.other_costs.toFixed(2));
  const [quoteProducts, setQuoteProducts] = useState(service.quote_products || service.products || []);

  useEffect(() => {
    if (service) {
      setQuotePrice(service.quote_price?.toFixed(2) || service.price.toFixed(2));
      setQuoteLaborCostPerHour(service.quote_labor_cost_per_hour?.toFixed(2) || service.labor_cost_per_hour.toFixed(2));
      setQuoteExecutionTimeHHMM(formatMinutesToHHMM(service.quote_execution_time_minutes || service.execution_time_minutes));
      setQuoteOtherCosts(service.quote_other_costs?.toFixed(2) || service.other_costs.toFixed(2));
      setQuoteProducts(service.quote_products || service.products || []);
    }
  }, [service, isOpen]);

  const handleSave = () => {
    const parsedQuotePrice = parseFloat(quotePrice);
    const parsedQuoteLaborCostPerHour = parseFloat(quoteLaborCostPerHour);
    const parsedQuoteExecutionTimeMinutes = parseHHMMToMinutes(quoteExecutionTimeHHMM);
    const parsedQuoteOtherCosts = parseFloat(quoteOtherCosts);

    if (isNaN(parsedQuotePrice) || parsedQuotePrice < 0) {
      toast({ title: "Valor inválido", description: "O valor cobrado deve ser um número positivo.", variant: "destructive" });
      return;
    }
    if (isNaN(parsedQuoteLaborCostPerHour) || parsedQuoteLaborCostPerHour < 0) {
      toast({ title: "Custo da hora de trabalho inválido", description: "O custo da hora de trabalho deve ser um número positivo.", variant: "destructive" });
      return;
    }
    if (isNaN(parsedQuoteExecutionTimeMinutes) || parsedQuoteExecutionTimeMinutes < 0) {
      toast({ title: "Tempo de execução inválido", description: "O tempo de execução deve estar no formato HH:MM e ser um valor positivo.", variant: "destructive" });
      return;
    }
    if (isNaN(parsedQuoteOtherCosts) || parsedQuoteOtherCosts < 0) {
      toast({ title: "Outros Custos inválidos", description: "O valor de 'Outros Custos' deve ser um número positivo.", variant: "destructive" });
      return;
    }

    const updatedService: QuotedService = {
      ...service,
      quote_price: parsedQuotePrice,
      quote_labor_cost_per_hour: parsedQuoteLaborCostPerHour,
      quote_execution_time_minutes: parsedQuoteExecutionTimeMinutes,
      quote_other_costs: parsedQuoteOtherCosts,
      quote_products: quoteProducts, // Manter os produtos (mesmo que não editáveis aqui ainda)
    };
    onSave(updatedService);
    onClose();
  };

  const getProductCost = (product: QuotedService['products'][0]) => {
    if (!product) return 0;
    const productForCalc: ProductForCalculation = {
      gallonPrice: product.price,
      gallonVolume: product.size * 1000, // Convert liters to ml
      dilutionRatio: product.dilution_ratio,
      usagePerVehicle: product.usage_per_vehicle,
      type: product.type,
      containerSize: product.container_size,
    };
    return calculateProductCost(productForCalc);
  };

  const totalProductsCostForService = quoteProducts.reduce((sum, product) => sum + getProductCost(product), 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-card">
        <DialogHeader>
          <DialogTitle>Editar Serviço para Orçamento: {service.name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="quote-price">Valor Cobrado (R$) *</Label>
            <Input 
              id="quote-price" 
              type="number" 
              step="0.01" 
              value={quotePrice} 
              onChange={(e) => setQuotePrice(e.target.value)} 
              className="bg-background" 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quote-labor-cost-per-hour">Custo da Mão de Obra/Hora (R$) *</Label>
            <div className="flex gap-2">
              <Input 
                id="quote-labor-cost-per-hour" 
                type="number" 
                step="0.01" 
                value={quoteLaborCostPerHour} 
                onChange={(e) => setQuoteLaborCostPerHour(e.target.value)} 
                className="flex-1 bg-background" 
              />
              <LoadHourlyCostButton onLoad={(cost) => setQuoteLaborCostPerHour(cost.toFixed(2))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="quote-execution-time">Tempo de Execução do Serviço (HH:MM) *</Label>
            <Input 
              id="quote-execution-time" 
              type="text"
              placeholder="Ex: 01:30 (1 hora e 30 minutos)"
              value={quoteExecutionTimeHHMM} 
              onChange={(e) => setQuoteExecutionTimeHHMM(e.target.value)} 
              className="bg-background" 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quote-other-costs">Outros Custos (R$)</Label>
            <Input 
              id="quote-other-costs" 
              type="number" 
              step="0.01" 
              value={quoteOtherCosts} 
              onChange={(e) => setQuoteOtherCosts(e.target.value)} 
              className="bg-background" 
              placeholder="Ex: 15.00 (custos adicionais)"
            />
          </div>

          {productCostCalculationMethod === 'per-service' && (
            <div className="space-y-2 pt-4 border-t border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium">Produtos Vinculados</Label>
              </div>
              {quoteProducts.length > 0 ? (
                <ul className="space-y-2">
                  {quoteProducts.map((product) => (
                    <li key={product.id} className="flex items-center justify-between p-2 rounded-md bg-muted/20 border border-border/50">
                      <div>
                        <p className="font-medium text-foreground">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Uso: {product.usage_per_vehicle.toFixed(0)} ml | Custo: R$ {getProductCost(product).toFixed(2)}
                          {product.type === 'diluted' && ` | Diluição: ${formatDilutionRatio(product.dilution_ratio)}`}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {/* Botões de editar e apagar produtos (funcionalidade futura) */}
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" title="Editar produto (funcionalidade futura)" disabled>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" title="Remover produto (funcionalidade futura)" disabled>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground italic">Nenhum produto vinculado a este serviço.</p>
              )}
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/30 mt-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-foreground">Custo Total de Produtos:</span>
                  <span className="text-lg font-bold text-primary">R$ {totalProductsCostForService.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar Alterações</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};