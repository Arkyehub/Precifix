import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Droplet, Plus, Trash2 } from "lucide-react";
import type { CatalogProduct } from "./ProductCatalog";

export interface Product {
  id: string;
  name: string;
  gallonPrice: number;
  gallonVolume: number; // em ml
  dilutionRatio: number; // ex: 10 para 1:10
  usagePerVehicle: number; // em ml
  type: 'diluted' | 'ready-to-use'; // tipo do produto
}

interface ProductDilutionProps {
  onProductsChange: (products: Product[], totalCost: number) => void;
}

export function ProductDilution({ onProductsChange }: ProductDilutionProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>("");
  const [newProduct, setNewProduct] = useState({
    name: "",
    gallonPrice: "",
    gallonVolume: "",
    dilutionRatio: "",
    usagePerVehicle: "",
    type: "diluted" as 'diluted' | 'ready-to-use',
  });

  useEffect(() => {
    const saved = localStorage.getItem('productCatalog');
    if (saved) {
      setCatalogProducts(JSON.parse(saved));
    }

    const interval = setInterval(() => {
      const updated = localStorage.getItem('productCatalog');
      if (updated) {
        setCatalogProducts(JSON.parse(updated));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const calculateProductCost = (product: Product) => {
    if (product.type === 'ready-to-use') {
      // Para produtos prontos para uso: (Preço / Volume total) * Quantidade usada
      const costPerMl = product.gallonPrice / product.gallonVolume;
      return costPerMl * product.usagePerVehicle;
    } else {
      // Para produtos diluídos: cálculo com diluição
      const totalDilutedVolume = product.gallonVolume * (1 + product.dilutionRatio);
      const costPerLiter = product.gallonPrice / (totalDilutedVolume / 1000);
      const costPerApplication = (costPerLiter * product.usagePerVehicle) / 1000;
      return costPerApplication;
    }
  };

  const getTotalCost = () => {
    return products.reduce((sum, product) => sum + calculateProductCost(product), 0);
  };

  const loadFromCatalog = () => {
    const catalogProduct = catalogProducts.find(p => p.id === selectedCatalogId);
    if (catalogProduct) {
      setNewProduct({
        name: catalogProduct.name,
        gallonPrice: catalogProduct.price.toString(),
        gallonVolume: (catalogProduct.size * 1000).toString(), // convert liters to ml
        dilutionRatio: "",
        usagePerVehicle: "",
        type: "diluted",
      });
      setSelectedCatalogId("");
    }
  };

  const addProduct = () => {
    if (!newProduct.name || !newProduct.gallonPrice || !newProduct.gallonVolume) return;

    const product: Product = {
      id: `product-${Date.now()}`,
      name: newProduct.name,
      gallonPrice: parseFloat(newProduct.gallonPrice),
      gallonVolume: parseFloat(newProduct.gallonVolume),
      dilutionRatio: parseFloat(newProduct.dilutionRatio) || 0,
      usagePerVehicle: parseFloat(newProduct.usagePerVehicle) || 0,
      type: newProduct.type,
    };

    const updated = [...products, product];
    setProducts(updated);
    onProductsChange(updated, getTotalCost() + calculateProductCost(product));
    
    setNewProduct({
      name: "",
      gallonPrice: "",
      gallonVolume: "",
      dilutionRatio: "",
      usagePerVehicle: "",
      type: "diluted",
    });
  };

  const removeProduct = (id: string) => {
    const updated = products.filter((p) => p.id !== id);
    setProducts(updated);
    const newTotal = updated.reduce((sum, p) => sum + calculateProductCost(p), 0);
    onProductsChange(updated, newTotal);
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-card)] border-border/50">
      <div className="flex items-center gap-2 mb-4">
        <Droplet className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold text-foreground">Cálculo de Diluição de Produtos</h2>
      </div>

      {products.length > 0 && (
        <div className="mb-6 space-y-3">
          {products.map((product) => {
            const cost = calculateProductCost(product);
            
            return (
              <div
                key={product.id}
                className="p-4 bg-muted/30 rounded-lg border border-border/50 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-foreground">
                      {product.name}
                      <span className="ml-2 text-xs px-2 py-0.5 rounded bg-primary/20 text-primary">
                        {product.type === 'ready-to-use' ? 'Pronto Uso' : 'Diluído'}
                      </span>
                    </h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                      <span>Preço: R$ {product.gallonPrice.toFixed(2)}</span>
                      <span>Volume: {product.gallonVolume} ml</span>
                      {product.type === 'diluted' && (
                        <>
                          <span>Diluição: 1:{product.dilutionRatio}</span>
                          <span>Uso: {product.usagePerVehicle} ml</span>
                          <span className="text-primary font-medium col-span-2 mt-1">
                            Custo/litro diluído: R$ {(product.gallonPrice / ((product.gallonVolume * (1 + product.dilutionRatio)) / 1000)).toFixed(4)}
                          </span>
                        </>
                      )}
                      {product.type === 'ready-to-use' && (
                        <>
                          <span>Uso: {product.usagePerVehicle} ml</span>
                          <span className="text-primary font-medium col-span-2 mt-1">
                            Custo/ml: R$ {(product.gallonPrice / product.gallonVolume).toFixed(4)}
                          </span>
                        </>
                      )}
                      <span className="text-primary font-semibold col-span-2">
                        Custo/aplicação: R$ {cost.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeProduct(product.id)}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
            <p className="text-sm font-medium text-foreground">
              Custo Total dos Produtos:{" "}
              <span className="text-lg text-primary font-bold">R$ {getTotalCost().toFixed(2)}</span>
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4 pt-4 border-t border-border/50">
        <h3 className="text-sm font-medium text-foreground">Adicionar Novo Produto</h3>

        {catalogProducts.length > 0 && (
          <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 border border-border/50">
            <Label htmlFor="catalogSelect" className="text-sm">Selecionar do Catálogo</Label>
            <div className="flex gap-2 mt-2">
              <Select value={selectedCatalogId} onValueChange={setSelectedCatalogId}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Escolha um produto cadastrado" />
                </SelectTrigger>
                <SelectContent>
                  {catalogProducts.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} - {product.size}L - R$ {product.price.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={loadFromCatalog}
                disabled={!selectedCatalogId}
                variant="secondary"
              >
                Carregar
              </Button>
            </div>
          </div>
        )}
        
        <div className="space-y-2 mb-4">
          <Label htmlFor="product-type" className="text-sm">Tipo de Produto</Label>
          <Select 
            value={newProduct.type} 
            onValueChange={(value: 'diluted' | 'ready-to-use') => setNewProduct({ ...newProduct, type: value })}
          >
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="diluted">Produto Diluído</SelectItem>
              <SelectItem value="ready-to-use">Produto Pronto Uso</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="product-name" className="text-sm">Nome do Produto</Label>
            <Input
              id="product-name"
              placeholder="Ex: Shampoo Neutro"
              value={newProduct.name}
              onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gallon-price" className="text-sm">
              {newProduct.type === 'ready-to-use' ? 'Preço do Produto (R$)' : 'Preço do Galão (R$)'}
            </Label>
            <Input
              id="gallon-price"
              type="number"
              step="0.01"
              placeholder="150.00"
              value={newProduct.gallonPrice}
              onChange={(e) => setNewProduct({ ...newProduct, gallonPrice: e.target.value })}
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gallon-volume" className="text-sm">
              {newProduct.type === 'ready-to-use' ? 'Volume Total (ml)' : 'Volume do Galão (ml)'}
            </Label>
            <Input
              id="gallon-volume"
              type="number"
              placeholder="5000"
              value={newProduct.gallonVolume}
              onChange={(e) => setNewProduct({ ...newProduct, gallonVolume: e.target.value })}
              className="bg-background"
            />
          </div>

          {newProduct.type === 'diluted' && (
            <div className="space-y-2">
              <Label htmlFor="dilution-ratio" className="text-sm">Proporção de Diluição (1:X)</Label>
              <Input
                id="dilution-ratio"
                type="number"
                placeholder="10"
                value={newProduct.dilutionRatio}
                onChange={(e) => setNewProduct({ ...newProduct, dilutionRatio: e.target.value })}
                className="bg-background"
              />
            </div>
          )}

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="usage-per-vehicle" className="text-sm">Quantidade Usada por Veículo (ml)</Label>
            <Input
              id="usage-per-vehicle"
              type="number"
              placeholder="200"
              value={newProduct.usagePerVehicle}
              onChange={(e) => setNewProduct({ ...newProduct, usagePerVehicle: e.target.value })}
              className="bg-background"
            />
          </div>
        </div>

        <Button
          onClick={addProduct}
          className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-[var(--shadow-elegant)]"
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Produto
        </Button>
      </div>
    </Card>
  );
}
