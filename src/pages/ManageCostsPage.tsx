import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Plus, Pencil, Trash2, Clock, BarChart3, CalendarDays } from 'lucide-react'; // Adicionado CalendarDays
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CostFormDialog, OperationalCost } from "@/components/CostFormDialog";
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useLocation, useNavigate } from 'react-router-dom'; // Importar useLocation e useNavigate

interface OperationalHours {
  id?: string;
  user_id: string;
  monday_start: string;
  monday_end: string;
  tuesday_start: string;
  tuesday_end: string;
  wednesday_start: string;
  wednesday_end: string;
  thursday_start: string;
  thursday_end: string;
  friday_start: string;
  friday_end: string;
  saturday_start: string;
  saturday_end: string;
  sunday_start: string;
  sunday_end: string;
}

const initialHoursState: Omit<OperationalHours, 'id' | 'user_id' | 'created_at'> = {
  monday_start: '', monday_end: '',
  tuesday_start: '', tuesday_end: '',
  wednesday_start: '', wednesday_end: '',
  thursday_start: '', thursday_end: '',
  friday_start: '', friday_end: '',
  saturday_start: '', saturday_end: '',
  sunday_start: '', sunday_end: '',
};

const ManageCostsPage = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const location = useLocation(); // Hook para acessar o estado da navegação
  const navigate = useNavigate(); // Hook para navegar e substituir o estado

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<OperationalCost | undefined>(undefined);
  const [newCostDefaults, setNewCostDefaults] = useState<{ description?: string; type?: 'fixed' | 'variable' } | undefined>(undefined); // Novo estado para defaults de novo custo
  const [selectedDays, setSelectedDays] = useState<{ [key: string]: boolean }>({
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false,
    saturday: false,
    sunday: false,
  });
  const [operationalHours, setOperationalHours] = useState<Omit<OperationalHours, 'id' | 'user_id' | 'created_at'>>(initialHoursState);

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

  // Efeito para lidar com o estado de navegação
  useEffect(() => {
    if (location.state) {
      if (location.state.openAddCostDialog) {
        setIsFormDialogOpen(true);
        setEditingCost(undefined); // Garantir que é um novo custo
        setNewCostDefaults({
          description: location.state.defaultDescription,
          type: location.state.defaultType,
        });
      } else if (location.state.editingCostId && operationalCosts) {
        const costToEdit = operationalCosts.find(cost => cost.id === location.state.editingCostId);
        if (costToEdit) {
          setEditingCost(costToEdit);
          setNewCostDefaults(undefined); // Limpar defaults ao editar
          setIsFormDialogOpen(true);
        }
      }
      // Limpar o estado da navegação para evitar que o diálogo abra novamente
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate, operationalCosts]); // Adicionado operationalCosts como dependência

  // Fetch operational hours
  const { data: fetchedOperationalHours, isLoading: isLoadingHours, error: hoursError } = useQuery<OperationalHours | null>({
    queryKey: ['operationalHours', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('operational_hours')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (error && (error as any).code !== 'PGRST116') { // PGRST116 means no rows found
        console.error("Error fetching operational hours:", error);
        throw error;
      }
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (fetchedOperationalHours) {
      setOperationalHours({
        monday_start: fetchedOperationalHours.monday_start || '', monday_end: fetchedOperationalHours.monday_end || '',
        tuesday_start: fetchedOperationalHours.tuesday_start || '', tuesday_end: fetchedOperationalHours.tuesday_end || '',
        wednesday_start: fetchedOperationalHours.wednesday_start || '', wednesday_end: fetchedOperationalHours.wednesday_end || '',
        thursday_start: fetchedOperationalHours.thursday_start || '', thursday_end: fetchedOperationalHours.thursday_end || '',
        friday_start: fetchedOperationalHours.friday_start || '', friday_end: fetchedOperationalHours.friday_end || '',
        saturday_start: fetchedOperationalHours.saturday_start || '', saturday_end: fetchedOperationalHours.saturday_end || '',
        sunday_start: fetchedOperationalHours.sunday_start || '', sunday_end: fetchedOperationalHours.sunday_end || '',
      });

      // Initialize selectedDays based on fetched hours
      const initialSelectedDays: { [key: string]: boolean } = {};
      daysOfWeek.forEach(day => {
        const startKey = `${day.key}_start` as keyof typeof fetchedOperationalHours;
        const endKey = `${day.key}_end` as keyof typeof fetchedOperationalHours;
        initialSelectedDays[day.key] = !!(fetchedOperationalHours[startKey] || fetchedOperationalHours[endKey]);
      });
      setSelectedDays(initialSelectedDays);
    }
  }, [fetchedOperationalHours]);

  const upsertOperationalHoursMutation = useMutation({
    mutationFn: async (hours: Omit<OperationalHours, 'created_at'>) => {
      if (!user) throw new Error("Usuário não autenticado.");

      // Filter out hours for unselected days before saving
      const hoursToSave = { ...hours };
      daysOfWeek.forEach(day => {
        if (!selectedDays[day.key]) {
          (hoursToSave as any)[`${day.key}_start`] = '';
          (hoursToSave as any)[`${day.key}_end`] = '';
        }
      });

      if (fetchedOperationalHours?.id) {
        // Update existing entry
        const { data, error } = await supabase
          .from('operational_hours')
          .update(hoursToSave)
          .eq('id', fetchedOperationalHours.id)
          .eq('user_id', user.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        // Insert new entry
        const { data, error } = await supabase
          .from('operational_hours')
          .insert({ ...hoursToSave, user_id: user.id })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operationalHours', user?.id] });
      toast({
        title: "Horários operacionais salvos!",
        description: "Seus horários de trabalho foram atualizados.",
      });
    },
    onError: (err) => {
      console.error("Error saving operational hours:", err);
      toast({
        title: "Erro ao salvar horários operacionais",
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
      // Invalida também a query de productsMonthlyCostItem para atualizar o estado do radio na ProductCatalogPage
      queryClient.invalidateQueries({ queryKey: ['productsMonthlyCostItem', user?.id] });
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
    setNewCostDefaults(undefined); // Limpar defaults ao abrir manualmente
    setIsFormDialogOpen(true);
  };

  const handleEditCost = (cost: OperationalCost) => {
    setEditingCost(cost);
    setNewCostDefaults(undefined); // Limpar defaults ao editar
    setIsFormDialogOpen(true);
  };

  const handleDeleteCost = (id: string) => {
    deleteCostMutation.mutate(id);
  };

  const handleDayCheckboxToggle = (dayKey: string) => {
    setSelectedDays(prevDays => {
      const newSelectedDays = { ...prevDays, [dayKey]: !prevDays[dayKey] };
      
      // If the day is being unchecked, clear its hours
      if (!newSelectedDays[dayKey]) {
        setOperationalHours(prevHours => ({
          ...prevHours,
          [`${dayKey}_start`]: '',
          [`${dayKey}_end`]: '',
        }));
      }
      return newSelectedDays;
    });
  };

  const handleHourChange = (day: string, type: 'start' | 'end', value: string) => {
    setOperationalHours(prev => ({
      ...prev,
      [`${day}_${type}`]: value,
    }));
  };

  const handleSaveOperationalHours = () => {
    if (user) {
      upsertOperationalHoursMutation.mutate({ ...operationalHours, user_id: user.id });
    }
  };

  const fixedCosts = operationalCosts?.filter(cost => cost.type === 'fixed') || [];
  const variableCosts = operationalCosts?.filter(cost => cost.type === 'variable') || [];

  const sumFixedCosts = fixedCosts.reduce((sum, cost) => sum + cost.value, 0);
  const sumVariableCosts = variableCosts.reduce((sum, cost) => sum + cost.value, 0);
  const totalMonthlyExpenses = sumFixedCosts + sumVariableCosts;

  const daysOfWeek = [
    { key: 'monday', label: 'Seg' },
    { key: 'tuesday', label: 'Ter' },
    { key: 'wednesday', label: 'Qua' },
    { key: 'thursday', label: 'Qui' },
    { key: 'friday', label: 'Sex' },
    { key: 'saturday', label: 'Sáb' },
    { key: 'sunday', label: 'Dom' },
  ];

  // Calculate total working days in month
  const totalWorkingDaysInMonth = Object.values(selectedDays).filter(Boolean).length * 4; // Assuming 4 weeks in a month

  // Calculate average daily working hours (excluding 1 hour for lunch)
  const timeToMinutes = (time: string): number => {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  let totalWorkingMinutesPerWeek = 0;
  let daysWithActualHours = 0;

  daysOfWeek.forEach(day => {
    if (selectedDays[day.key]) {
      const startKey = `${day.key}_start` as keyof typeof operationalHours;
      const endKey = `${day.key}_end` as keyof typeof operationalHours;
      const startTime = operationalHours[startKey];
      const endTime = operationalHours[endKey];

      if (startTime && endTime) {
        const startMinutes = timeToMinutes(startTime);
        const endMinutes = timeToMinutes(endTime);
        let duration = endMinutes - startMinutes;
        
        // Subtract 1 hour (60 minutes) for lunch if duration is more than 1 hour
        if (duration > 60) {
          duration -= 60;
        } else {
          duration = 0; // If less than or equal to 1 hour, assume no work or no lunch break needed
        }

        if (duration > 0) {
          totalWorkingMinutesPerWeek += duration;
          daysWithActualHours++;
        }
      }
    }
  });

  const averageDailyWorkingHours = daysWithActualHours > 0 ? (totalWorkingMinutesPerWeek / daysWithActualHours) / 60 : 0;

  // Calculate Custo Diário
  const dailyCost = totalWorkingDaysInMonth > 0 ? totalMonthlyExpenses / totalWorkingDaysInMonth : 0;

  // Calculate Custo Hora
  const hourlyCost = averageDailyWorkingHours > 0 ? dailyCost / averageDailyWorkingHours : 0;


  if (isLoadingCosts || isLoadingHours) return <p>Carregando custos e horários operacionais...</p>;
  if (costsError) return <p>Erro ao carregar custos: {costsError.message}</p>;
  if (hoursError && (hoursError as any).code !== 'PGRST116') return <p>Erro ao carregar horários operacionais: {hoursError.message}</p>;

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
                          <TableCell className={cost.description === 'Produtos Gastos no Mês' ? 'font-medium text-primary-strong' : 'font-medium'}>
                            {cost.description}
                          </TableCell>
                          <TableCell className={cost.description === 'Produtos Gastos no Mês' ? 'text-right text-primary-strong font-bold' : 'text-right'}>
                            R$ {cost.value.toFixed(2)}
                          </TableCell>
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

          {/* Seção de Horas Trabalhadas (agora com seleção de dias integrada) */}
          <div className="space-y-4 pt-6 border-t border-border/50">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-semibold text-foreground">Horas Trabalhadas</h3>
            </div>
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
              <p className="text-sm font-medium text-foreground">
                Defina seus dias e horários de funcionamento.
              </p>
            </div>
            <div className="space-y-3">
              {daysOfWeek.map(day => (
                <div key={day.key} className="flex items-center gap-2">
                  <Checkbox 
                    id={day.key} 
                    checked={selectedDays[day.key]} 
                    onCheckedChange={() => handleDayCheckboxToggle(day.key)} 
                  />
                  <Label htmlFor={day.key} className="w-12">{day.label}:</Label>
                  <Input
                    type="time"
                    value={operationalHours[`${day.key}_start` as keyof typeof operationalHours]}
                    onChange={(e) => handleHourChange(day.key, 'start', e.target.value)}
                    className="flex-1 bg-background"
                    disabled={!selectedDays[day.key]}
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="time"
                    value={operationalHours[`${day.key}_end` as keyof typeof operationalHours]}
                    onChange={(e) => handleHourChange(day.key, 'end', e.target.value)}
                    className="flex-1 bg-background"
                    disabled={!selectedDays[day.key]}
                  />
                </div>
              ))}
            </div>
            <Button 
              onClick={handleSaveOperationalHours}
              className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
              disabled={upsertOperationalHoursMutation.isPending}
            >
              {upsertOperationalHoursMutation.isPending ? "Salvando..." : "Salvar Horários"}
            </Button>
          </div>

          {/* Nova Seção: Análise dos Custos */}
          <div className="space-y-4 pt-6 border-t border-border/50">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-semibold text-foreground">Análise dos Custos</h3>
            </div>
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/30 space-y-2">
              <p className="text-sm font-medium text-foreground">
                Total de Gastos no Mês (sem produtos):
              </p>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Despesas Fixas:</span>
                <span className="font-medium text-foreground">R$ {sumFixedCosts.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Despesas Variáveis:</span>
                <span className="font-medium text-foreground">R$ {sumVariableCosts.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-border/50">
                <span className="font-bold text-foreground">Total Mensal:</span>
                <span className="text-lg font-bold text-primary-strong">R$ {totalMonthlyExpenses.toFixed(2)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-gradient-to-br from-success/20 to-success/10 border border-success/30">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarDays className="h-4 w-4 text-success" />
                  <span className="text-sm text-success/80 font-medium">Custo Diário</span>
                </div>
                <p className="text-2xl font-bold text-success">R$ {dailyCost.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Baseado em {totalWorkingDaysInMonth} dias trabalhados/mês
                </p>
              </div>

              <div className="p-4 rounded-lg bg-gradient-to-br from-info/20 to-info/10 border border-info/30">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-info" />
                  <span className="text-sm text-info/80 font-medium">Custo por Hora</span>
                </div>
                <p className="text-2xl font-bold text-info">R$ {hourlyCost.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Considerando {averageDailyWorkingHours.toFixed(1)}h líquidas/dia
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <CostFormDialog
        isOpen={isFormDialogOpen}
        onClose={() => {
          setIsFormDialogOpen(false);
          setNewCostDefaults(undefined); // Limpar defaults ao fechar
        }}
        cost={editingCost}
        defaultDescription={newCostDefaults?.description}
        defaultType={newCostDefaults?.type}
      />
    </div>
  );
};

export default ManageCostsPage;