import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Package, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface CatalogProduct {
  id: string;
  name: string;
  size: number; // em litros
  price: number; // em R$
}

export const ProductCatalog = () => {
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [newProduct, setNewProduct] = useState({
    name: "",
    size: "",
    price: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    const saved = localStorage.getItem('productCatalog');
    if (saved) {
      setCatalogProducts(JSON.parse(saved));
    }
  }, []);

  const saveToLocalStorage = (products: CatalogProduct[]) => {
    localStorage.setItem('productCatalog', JSON.stringify(products));
  };

  const addProduct = () => {
    if (!newProduct.name || !newProduct.size || !newProduct.price) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos do produto.",
        variant: "destructive",
      });
      return;
    }

    const product: CatalogProduct = {
      id: Date.now().toString(),
      name: newProduct.name,
      size: parseFloat(newProduct.size),
      price: parseFloat(newProduct.price),
    };

    const updatedProducts = [...catalogProducts, product];
    setCatalogProducts(updatedProducts);
    saveToLocalStorage(updatedProducts);

    setNewProduct({ name: "", size: "", price: "" });

    toast({
      title: "Produto cadastrado!",
      description: `${product.name} foi adicionado ao catálogo.`,
    });
  };

  const removeProduct = (id: string) => {
    const updatedProducts = catalogProducts.filter((p) => p.id !== id);
    setCatalogProducts(updatedProducts);
    saveToLocalStorage(updatedProducts);

    toast({
      title: "Produto removido",
      description: "O produto foi excluído do catálogo.",
    });
  };

  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 shadow-[var(--shadow-elegant)]">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg">
            <Package className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-foreground">Catálogo de Produtos</CardTitle>
            <CardDescription>
              Cadastre seus produtos para reutilizar nos cálculos
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="productName">Nome do Produto</Label>
            <Input
              id="productName"
              value={newProduct.name}
              onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
              placeholder="Ex: Shampoo Automotivo"
              className="bg-background/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="productSize">Tamanho (Litros)</Label>
            <Input
              id="productSize"
              type="number"
              step="0.1"
              value={newProduct.size}
              onChange={(e) => setNewProduct({ ...newProduct, size: e.target.value })}
              placeholder="Ex: 5"
              className="bg-background/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="productPrice">Preço (R$)</Label>
            <Input
              id="productPrice"
              type="number"
              step="0.01"
              value={newProduct.price}
              onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
              placeholder="Ex: 89.90"
              className="bg-background/50"
            />
          </div>
        </div>

        <Button 
          onClick={addProduct}
          className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar ao Catálogo
        </Button>

        {catalogProducts.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Produtos Cadastrados</h3>
            <div className="space-y-2">
              {catalogProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-primary/5 to-secondary/5 border border-border/50"
                >
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {product.size}L - R$ {product.price.toFixed(2)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeProduct(product.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {catalogProducts.length === 0 && (
          <p className="text-sm text-muted-foreground text-center italic py-4">
            Nenhum produto cadastrado ainda. Adicione produtos para facilitar seus cálculos!
          </p>
        )}
      </CardContent>
    </Card>
  );
};
