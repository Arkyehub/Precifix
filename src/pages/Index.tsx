import { useState } from "react";
import { ServiceSelector } from "@/components/ServiceSelector";
import { ProductCatalog } from "@/components/ProductCatalog";
import { ProductDilution, Product } from "@/components/ProductDilution";
import { OperationalCosts } from "@/components/OperationalCosts";
import { Results } from "@/components/Results";
import { QuoteGenerator } from "@/components/QuoteGenerator";
// Removido Sparkles, LogOut, Button, supabase, useNavigate pois agora estão no Header/Layout

const Index = () => {
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsCost, setProductsCost] = useState(0);
  const [executionTime, setExecutionTime] = useState(0);
  const [laborCostPerHour, setLaborCostPerHour] = useState(0);
  const [otherCosts, setOtherCosts] = useState(0);
  const [profitMargin, setProfitMargin] = useState(40);
  // Removido useNavigate e handleLogout

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

  const laborCost = (executionTime / 60) * laborCostPerHour;
  const totalCost = productsCost + laborCost + otherCosts;
  const finalPrice = profitMargin > 0 ? totalCost / (1 - profitMargin / 100) : totalCost;

  return (
    <div className="container mx-auto px-4 py-8"> {/* Conteúdo principal da página */}
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
    </div>
  );
};

export default Index;