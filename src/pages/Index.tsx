import { useState } from "react";
import { ServiceSelector } from "@/components/ServiceSelector";
import { ProductCatalog } from "@/components/ProductCatalog";
import { ProductDilution, Product } from "@/components/ProductDilution";
import { OperationalCosts } from "@/components/OperationalCosts";
import { Results } from "@/components/Results";
import { QuoteGenerator } from "@/components/QuoteGenerator";
import { Sparkles, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsCost, setProductsCost] = useState(0);
  const [executionTime, setExecutionTime] = useState(0);
  const [laborCostPerHour, setLaborCostPerHour] = useState(0);
  const [otherCosts, setOtherCosts] = useState(0);
  const [profitMargin, setProfitMargin] = useState(40);
  const navigate = useNavigate();

  const handleProductsChange = (updatedProducts: Product[], totalCost: number) => {
    setProducts(updatedProducts);
    setProductsCost(totalCost);
  };

  const handleCostsChange = (costs: {
    executionTime: number;
    laborCostPerHour: number;
    otherCosts: number;
  }) => {
    setExecutionTime(costs.executionTime);
    setLaborCostPerHour(costs.laborCostPerHour);
    setOtherCosts(costs.otherCosts);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const laborCost = (executionTime / 60) * laborCostPerHour;
  const totalCost = productsCost + laborCost + otherCosts;
  const finalPrice = profitMargin > 0 ? totalCost / (1 - profitMargin / 100) : totalCost;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-gradient-to-r from-primary/5 to-secondary/5">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg shadow-[var(--shadow-elegant)]">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Calculadora de Precificação</h1>
              <p className="text-sm text-muted-foreground">
                Insira seus custos e descubra o preço ideal para lucrar com sustentabilidade.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <ServiceSelector onServicesChange={setSelectedServices} />

          <ProductCatalog />
          
          <ProductDilution onProductsChange={handleProductsChange} />
          
          <OperationalCosts
            productsCost={productsCost}
            executionTime={executionTime}
            laborCostPerHour={laborCostPerHour}
            otherCosts={otherCosts}
            onCostsChange={handleCostsChange}
          />
          
          <Results
            totalCost={totalCost}
            profitMargin={profitMargin}
            executionTime={executionTime}
            onMarginChange={setProfitMargin}
          />
          
          <QuoteGenerator
            selectedServices={selectedServices}
            totalCost={totalCost}
            finalPrice={finalPrice}
            executionTime={executionTime}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-16 py-6 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Seu negócio está no caminho certo. Continue precificando com estratégia! 🚗✨
          </p>
          <Button 
            onClick={handleLogout} 
            variant="outline" 
            className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Encerrar Sessão
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default Index;