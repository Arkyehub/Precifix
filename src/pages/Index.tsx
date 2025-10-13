import { useState } from "react";
// Removido ServiceSelector
import { ProductCatalog } from "@/components/ProductCatalog";
import { ProductDilution, Product } from "@/components/ProductDilution";
import { OperationalCosts } from "@/components/OperationalCosts";
import { Results } from "@/components/Results";
import { QuoteGenerator } from "@/components/QuoteGenerator";
// Removido Sparkles, LogOut, Button, supabase, useNavigate pois agora estão no Header/Layout

const Index = () => {
  const [selectedServices, setSelectedServices] = useState<string[]>([]); // Manter para QuoteGenerator, mas será preenchido de outra forma
  const [products, setProducts] = useState<Product[]>([]);
  const [productsCost, setProductsCost] = useState(0);
  const [executionTime, setExecutionTime] = useState(0);
  const [laborCostPerHour, setLaborCostPerHour] = useState(0);
  const [otherCosts, setOtherCosts] = useState(0);
  const [profitMargin, setProfitMargin] = useState(40);

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
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* O ServiceSelector foi movido para a página /services */}
        {/* <ServiceSelector onServicesChange={setSelectedServices} /> */}

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
          selectedServices={selectedServices} // Este precisará ser ajustado para buscar serviços do DB
          totalCost={totalCost}
          finalPrice={finalPrice}
          executionTime={executionTime}
        />
      </div>
    </div>
  );
};

export default Index;