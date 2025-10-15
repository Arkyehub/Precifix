import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Droplet, Plus, Trash2 } from "lucide-react";
import type { CatalogProduct } from "./ProductFormDialog";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery } from "@tanstack/react-query";
import { calculateProductCost, formatDilutionRatio, ProductForCalculation } from "@/lib/cost-calculations"; // Importar do utilitário

export interface Product {
  id: string;
  name: string;
  gallonPrice: number;
  gallonVolume: number; // em ml
  dilutionRatio: number; // ex: 10 para 1:10
  usagePerVehicle: number; // em ml
  type: 'diluted' | 'ready-to-use'; // tipo do produto, agora vem do catálogo
}

interface ProductDilutionProps {
  onProductsChange: (products: Product[], totalCost: number) => void;
}

export function ProductDilution({ onProductsChange }: ProductDilutionProps) {
  const { user } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>("");
  const [newProduct, setNewProduct] = useState({
    name: "",
    gallonPrice: "",
    gallonVolume: "",
    usagePerVehicle: "",
  });
  const [loadedCatalogProductDetails, setLoadedCatalogProductDetails] = useState<Omit<Product, 'id' | 'usagePerVehicle'> | null>(null);


  const { data: catalogProducts, isLoading: isLoadingCatalog } = useQuery<CatalogProduct[]>({
    queryKey: ['productCatalog', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('product_catalog_items')
        .select('*')
        .eq('user_id', user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    // Recalcular o custo total sempre que os produtos mudarem
    onProductsChange(products, getTotalCost());
  }, [products]); // eslint-disable-line react-hooks/exhaustive-deps

  const getProductCost = (product: Product) => {
    const productForCalc: ProductForCalculation = {
      gallonPrice: product.gallonPrice,
      gallonVolume: product.gallonVolume,
      dilutionRatio: product.dilutionRatio,
      usagePerVehicle: product.usagePerVehicle,
      type: product.type,
    };
    return calculateProductCost(productForCalc);
  };

  const getTotalCost = () => {
    return products.reduce((sum, product) => sum + getProductCost(product), 0);
  };

  const loadFromCatalog = () => {
    const catalogProduct = catalogProducts?.find(p => p.id === selectedCatalogId);
    if (catalogProduct) {
      setNewProduct({
        name: catalogProduct.name,
        gallonPrice: catalogProduct.price.toFixed(2),
        gallonVolume: (catalogProduct.size * 1000).toFixed(0), // convert liters to ml, keep as integer
        usagePerVehicle: "",
      });
      setLoadedCatalogProductDetails({
        name: catalogProduct.name,
        gallonPrice: catalogProduct.price,
        gallonVolume: catalogProduct.size * 1000,
        dilutionRatio: catalogProduct.dilution_ratio,
        type: catalogProduct.type,
      });
      setSelectedCatalogId("");
    }
  };

  const addProduct = () => {
    if (!newProduct.name || !newProduct.gallonPrice || !newProduct.gallonVolume || !loadedCatalogProductDetails) return;

    const product: Product = {
      id: `product-${Date.now()}`,
      name: newProduct.name,
      gallonPrice: parseFloat(newProduct.gallonPrice),
      gallonVolume: parseFloat(newProduct.gallonVolume),
      dilutionRatio: loadedCatalogProductDetails.dilutionRatio,
      usagePerVehicle: parseFloat(newProduct.usagePerVehicle) || 0,
      type: loadedCatalogProductDetails.type,
    };

    const updated = [...products, product];
    setProducts(updated);
    
    setNewProduct({
      name: "",
      gallonPrice: "",
      gallonVolume: "",
      usagePerVehicle: "",
    });
    setLoadedCatalogProductDetails(null);
  };

  const removeProduct = (id: string) => {
    const updated = products.filter((p) => p.id !== id);
    setProducts(updated);
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
            const cost = getProductCost(product);
            const concentratedProductUsed = product.type === 'diluted' 
              ? (product.usagePerVehicle / product.dilutionRatio) 
              : 0;
            
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
                      <span>Volume: {product.gallonVolume.toFixed(0)} ml</span>
                      {product.type === 'diluted' && (
                        <>
                          <span>Diluição: {formatDilutionRatio(product.dilutionRatio)}</span>
                          <span>Produto usado na diluição: {concentratedProductUsed.toFixed(0)} ml</span>
                          <span>Uso: {product.usagePerVehicle.toFixed(0)} ml</span>
                          <span className="text-primary font-medium col-span-2 mt-1">
                            Custo/ml diluído: R$ {(product.gallonPrice / (product.gallonVolume * product.dilutionRatio)).toFixed(4)}
                          </span>
                        </>
                      )}
                      {product.type === 'ready-to-use' && (
                        <>
                          <span>Uso: {product.usagePerVehicle.toFixed(0)} ml</span>
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
        <h3 className="text-sm font-medium text-foreground">Adicionar Produto</h3>

        {catalogProducts && catalogProducts.length > 0 && (
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
                      {product.name} - {product.size.toFixed(2)}L - R$ {product.price.toFixed(2)}
                      {product.type === 'diluted' && ` (Diluição: ${formatDilutionRatio(product.dilution_ratio)})`}
                      {product.type === 'ready-to-use' && ` (Pronto Uso)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={loadFromCatalog}
                disabled={!selectedCatalogId || isLoadingCatalog}
                variant="secondary"
              >
                Carregar
              </Button>
            </div>
          </div>
        )}
        
        {loadedCatalogProductDetails && (
          <div className="p-4 rounded-lg bg-muted/30 border border-border/50 space-y-2">
            <p className="font-medium text-foreground">Produto Carregado: {loadedCatalogProductDetails.name}</p>
            <p className="text-sm text-muted-foreground">
              Preço: R$ {loadedCatalogProductDetails.gallonPrice.toFixed(2)} | Volume: {loadedCatalogProductDetails.gallonVolume.toFixed(0)} ml
            </p>
            <p className="text-sm text-muted-foreground">
              Tipo: {loadedCatalogProductDetails.type === 'diluted' ? 'Diluído' : 'Pronto Uso'}
              {loadedCatalogProductDetails.type === 'diluted' && ` | Diluição: ${formatDilutionRatio(loadedCatalogProductDetails.dilutionRatio)}`}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="usage-per-vehicle" className="text-sm">Quantidade Usada por Veículo (ml)</Label>
            <Input
              id="usage-per-vehicle"
              type="number"
              placeholder="200"
              value={newProduct.usagePerVehicle}
              onChange={(e) => setNewProduct({ ...newProduct, usagePerVehicle: e.target.value })}
              className="bg-background"
              disabled={!loadedCatalogProductDetails}
            />
          </div>
        </div>

        <Button
          onClick={addProduct}
          className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-[var(--shadow-elegant)]"
          disabled={!loadedCatalogProductDetails || !newProduct.usagePerVehicle}
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Produto à Lista
        </Button>
      </div>
    </Card>
  );
}