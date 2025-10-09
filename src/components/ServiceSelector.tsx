import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Car } from "lucide-react";

interface Service {
  id: string;
  name: string;
  description?: string;
  selected: boolean;
  custom?: boolean;
}

const DEFAULT_SERVICES: Omit<Service, "selected">[] = [
  { id: "1", name: "Lavagem simples" },
  { id: "2", name: "Lavagem Técnica" },
  { id: "3", name: "Higienização interna" },
  { id: "4", name: "Polimento comercial" },
  { id: "5", name: "Polimento Técnico" },
  { id: "6", name: "Enceramento" },
  { id: "7", name: "Vitrificação de pintura" },
  { id: "8", name: "Limpeza de motor" },
  { id: "9", name: "Limpeza dos bancos de couro" },
];

export function ServiceSelector({ onServicesChange }: { onServicesChange: (services: string[]) => void }) {
  const [services, setServices] = useState<Service[]>(
    DEFAULT_SERVICES.map((s) => ({ ...s, selected: false }))
  );
  const [customName, setCustomName] = useState("");
  const [customDescription, setCustomDescription] = useState("");

  const toggleService = (id: string) => {
    const updated = services.map((s) =>
      s.id === id ? { ...s, selected: !s.selected } : s
    );
    setServices(updated);
    onServicesChange(updated.filter(s => s.selected).map(s => s.name));
  };

  const addCustomService = () => {
    if (!customName.trim()) return;
    
    const newService: Service = {
      id: `custom-${Date.now()}`,
      name: customName,
      description: customDescription,
      selected: true,
      custom: true,
    };
    
    const updated = [...services, newService];
    setServices(updated);
    onServicesChange(updated.filter(s => s.selected).map(s => s.name));
    setCustomName("");
    setCustomDescription("");
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-card)] border-border/50">
      <div className="flex items-center gap-2 mb-4">
        <Car className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold text-foreground">Serviços Oferecidos</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {services.map((service) => (
          <div
            key={service.id}
            className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <Checkbox
              id={service.id}
              checked={service.selected}
              onCheckedChange={() => toggleService(service.id)}
              className="mt-1"
            />
            <label
              htmlFor={service.id}
              className="flex-1 cursor-pointer text-sm font-medium leading-tight"
            >
              {service.name}
              {service.description && (
                <p className="text-xs text-muted-foreground mt-1">{service.description}</p>
              )}
            </label>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-border/50">
        <h3 className="text-sm font-medium mb-3 text-foreground">Adicionar Serviço Personalizado</h3>
        <div className="space-y-3">
          <Input
            placeholder="Nome do serviço"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            className="bg-background border-input"
          />
          <Input
            placeholder="Descrição (opcional)"
            value={customDescription}
            onChange={(e) => setCustomDescription(e.target.value)}
            className="bg-background border-input"
          />
          <Button
            onClick={addCustomService}
            variant="outline"
            className="w-full border-primary/30 hover:bg-primary/10 hover:border-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Serviço
          </Button>
        </div>
      </div>
    </Card>
  );
}
