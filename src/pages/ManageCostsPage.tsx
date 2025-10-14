import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Plus, Pencil, Trash2, CalendarDays } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CostFormDialog, OperationalCost } from "@/components/CostFormDialog";
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface OperationalDays {
  id?: string;
  user_id: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

const ManageCostsPage = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<OperationalCost | undefined>(undefined);
  const [selectedDays, setSelectedDays] = useState<Omit<OperationalDays, 'id' | 'user_id' | 'created_at'>>({
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false,
    saturday: false,
    sunday: false,
  });

  // Fetch operational costs
  const { data: operationalCosts, isLoading: isLoadingCosts, error: costsError } = useQuery<OperationalCost[]>({
    queryKey: ['operationalCosts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('operational_costs')
        .select('*')
        .eq('user_id', user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch operational days
  const { data: fetchedOperationalDays, isLoading: isLoadingDays, error: daysError } = useQuery<OperationalDays | null>({
    queryKey: ['operationalDays', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('operational_days')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (error && (error as any).code !== 'PGRST116') { // PGRST116 means no rows found
        console.error("Error fetching operational days:", error);
        throw error;
      }
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (fetchedOperationalDays) {
      setSelectedDays({
        monday: fetchedOperationalDays.monday,
        tuesday: fetchedOperationalDays.tuesday,
        wednesday: fetchedOperationalDays.wednesday,
        thursday: fetchedOperationalDays.thursday,
        friday: fetchedOperationalDays.friday,
        saturday: fetchedOperationalDays.saturday,
        sunday: fetchedOperationalDays.sunday,
      });
    }
  }, [fetchedOperationalDays]);

  const upsertOperationalDaysMutation = useMutation({
    mutationFn: async (days: Omit<OperationalDays, 'created_at'>) => {
      if (!user) throw new Error("Usuário não autenticado.");

      if (fetchedOperationalDays?.id) {
        // Update existing entry
        const { data, error } = await supabase
          .from('operational_days')
          .update(days)
          .eq('id', fetchedOperationalDays.id)
          .eq('user_id', user.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        // Insert new entry
        const { data, error } = await supabase
          .from('operational_days')
          .insert({ ...days, user_id: user.id })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operationalDays', user?.id] });
      toast({
        title: "Dias operacionais salvos!",
        description: "Seus dias de trabalho foram atualizados.",
      });
    },
    onError: (err) => {
      console.error("Error saving operational days:", err);
      toast({
        title: "Erro ao salvar dias operacionais",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const deleteCostMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('operational_costs')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operationalCosts', user?.id] });
      toast({
        title: "Custo removido",
        description: "O custo foi excluído com sucesso.",
      });
    },
    onError: (err) => {
      console.error("Error deleting cost:", err);
      toast({
        title: "Erro ao remover custo",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleAddCost = () => {
    setEditingCost(undefined);
    setIsFormDialogOpen(true);
  };

  const handleEditCost = (cost: OperationalCost) => {
    setEditingCost(cost);
    setIsFormDialogOpen(true);
  };

  const handleDeleteCost = (id: string) => {
    deleteCostMutation.mutate(id);
  };

  const handleDayToggle = (day: keyof Omit<OperationalDays, 'id' | 'user_id' | 'created_at'>) => {
    setSelectedDays(prev => ({ ...prev, [day]: !prev[day] }));
  };

  const handleSaveOperationalDays = () => {
    if (user) {
      upsertOperationalDaysMutation.mutate({ ...selectedDays, user_id: user.id });
    }
  };

  const calculateTotalOperationalDays = () => {
    const daysPerWeek = Object.values(selectedDays).filter(Boolean).length;
    // Assuming roughly 4 weeks in a month
    return daysPerWeek * 4;
  };

  const fixedCosts = operationalCosts?.filter(cost => cost.type === 'fixed') || [];
  const variableCosts = operationalCosts?.filter(cost => cost.type === 'variable') || [];

  if (isLoadingCosts || isLoadingDays) return <p>Carregando custos e dias operacionais...</p>;
  if (costsError) return <p>Erro ao carregar custos: {costsError.message}</p>;
  if (daysError && (daysError as any).code !== 'PGRST116') return <p>Erro ao carregar dias operacionais: {daysError.message}</p>;

  const totalOperationalDays = calculateTotalOperationalDays();

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 shadow-[var(--shadow-elegant)]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg">
              <DollarSign className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-foreground">Gerenciar Custos Operacionais</CardTitle>
              <CardDescription>
                Configure e visualize seus custos fixos e variáveis para uma precificação precisa.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tabela de Custos Fixos */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Custos Fixos</h3>
              <div className="rounded-md border bg-background/50">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-[80px] text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fixedCosts.length > 0 ? (
                      fixedCosts.map((cost) => (
                        <TableRow key={cost.id}>
                          <TableCell className="font-medium">{cost.description}</TableCell>
                          <TableCell className="text-right">R$ {cost.value.toFixed(2)}</TableCell>
                          <TableCell className="flex justify-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEditCost(cost)} className="text-primary hover:bg-primary/10">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-card">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação não pode ser desfeita. Isso excluirá permanentemente o custo "{cost.description}".
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteCost(cost.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                          Nenhum custo fixo cadastrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Tabela de Custos Variáveis */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Custos Variáveis</h3>
              <div className="rounded-md border bg-background/50">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-[80px] text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variableCosts.length > 0 ? (
                      variableCosts.map((cost) => (
                        <TableRow key={cost.id}>
                          <TableCell className="font-medium">{cost.description}</TableCell>
                          <TableCell className="text-right">R$ {cost.value.toFixed(2)}</TableCell>
                          <TableCell className="flex justify-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEditCost(cost)} className="text-primary hover:bg-primary/10">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-card">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação não pode ser desfeita. Isso excluirá permanentemente o custo "{cost.description}".
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteCost(cost.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                          Nenhum custo variável cadastrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleAddCost}
            className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Novo Custo
          </Button>

          {/* Nova Seção: Dias Operacionais */}
          <div className="space-y-4 pt-6 border-t border-border/50">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-semibold text-foreground">Dias Operacionais</h3>
            </div>
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
              <p className="text-sm font-medium text-foreground">
                Dias Trabalhados no Mês (estimado):{" "}
                <span className="text-lg text-primary font-bold">{totalOperationalDays}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                (Baseado em 4 semanas por mês)
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox id="monday" checked={selectedDays.monday} onCheckedChange={() => handleDayToggle('monday')} />
                <Label htmlFor="monday">Seg</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="tuesday" checked={selectedDays.tuesday} onCheckedChange={() => handleDayToggle('tuesday')} />
                <Label htmlFor="tuesday">Ter</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="wednesday" checked={selectedDays.wednesday} onCheckedChange={() => handleDayToggle('wednesday')} />
                <Label htmlFor="wednesday">Qua</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="thursday" checked={selectedDays.thursday} onCheckedChange={() => handleDayToggle('thursday')} />
                <Label htmlFor="thursday">Qui</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="friday" checked={selectedDays.friday} onCheckedChange={() => handleDayToggle('friday')} />
                <Label htmlFor="friday">Sex</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="saturday" checked={selectedDays.saturday} onCheckedChange={() => handleDayToggle('saturday')} />
                <Label htmlFor="saturday">Sáb</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="sunday" checked={selectedDays.sunday} onCheckedChange={() => handleDayToggle('sunday')} />
                <Label htmlFor="sunday">Dom</Label>
              </div>
            </div>
            <Button 
              onClick={handleSaveOperationalDays}
              className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
              disabled={upsertOperationalDaysMutation.isPending}
            >
              {upsertOperationalDaysMutation.isPending ? "Salvando..." : "Salvar Dias Operacionais"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <CostFormDialog
        isOpen={isFormDialogOpen}
        onClose={() => setIsFormDialogOpen(false)}
        cost={editingCost}
      />
    </div>
  );
};

export default ManageCostsPage;