import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Plus, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from 'react-router-dom';

import { CostFormDialog, OperationalCost } from "@/components/CostFormDialog";
import FixedCostsTable from '@/components/costs/FixedCostsTable';
import VariableCostsTable from '@/components/costs/VariableCostsTable';
import OperationalHoursForm from '@/components/costs/OperationalHoursForm';
import { CostAnalysisSummary } from '@/components/costs/CostAnalysisSummary';
import { OperationalHours, daysOfWeek } from '@/types/costs';
import { timeToMinutes } from '@/lib/cost-calculations'; // Importar do utilitário

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
  const location = useLocation();
  const navigate = useNavigate();

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<OperationalCost | undefined>(undefined);
  const [newCostDefaults, setNewCostDefaults] = useState<{ description?: string; type?: 'fixed' | 'variable' } | undefined>(undefined);
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

  // Fetch products monthly cost item to determine calculation method
  const { data: productsMonthlyCostItem, isLoading: isLoadingMonthlyCost } = useQuery<OperationalCost | null>({
    queryKey: ['productsMonthlyCostItem', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('operational_costs')
        .select('*')
        .eq('user_id', user.id)
        .eq('description', 'Produtos Gastos no Mês')
        .single();
      if (error && (error as any).code !== 'PGRST116') {
        console.error("Error fetching products monthly cost item:", error);
        throw error;
      }
      return data;
    },
    enabled: !!user,
  });

  const productCostCalculationMethod = productsMonthlyCostItem ? 'monthly-average' : 'per-service';

  // Efeito para lidar com o estado de navegação
  useEffect(() => {
    if (location.state) {
      if (location.state.openAddCostDialog) {
        setIsFormDialogOpen(true);
        setEditingCost(undefined);
        setNewCostDefaults({
          description: location.state.defaultDescription,
          type: location.state.defaultType,
        });
      } else if (location.state.editingCostId && operationalCosts) {
        const costToEdit = operationalCosts.find(cost => cost.id === location.state.editingCostId);
        if (costToEdit) {
          setEditingCost(costToEdit);
          setNewCostDefaults(undefined);
          setIsFormDialogOpen(true);
        }
      }
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate, operationalCosts]);

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

      const hoursToSave = { ...hours };
      daysOfWeek.forEach(day => {
        if (!selectedDays[day.key]) {
          (hoursToSave as any)[`${day.key}_start`] = '';
          (hoursToSave as any)[`${day.key}_end`] = '';
        }
      });

      if (fetchedOperationalHours?.id) {
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

  // NOVO: Mutação para atualizar o custo da hora de trabalho em todos os serviços
  const updateServicesLaborCostMutation = useMutation({
    mutationFn: async (newHourlyCost: number) => {
      if (!user) throw new Error("Usuário não autenticado.");

      const { data: servicesToUpdate, error: fetchServicesError } = await supabase
        .from('services')
        .select('id')
        .eq('user_id', user.id);

      if (fetchServicesError) throw fetchServicesError;

      const updates = servicesToUpdate.map(service => ({
        id: service.id,
        labor_cost_per_hour: newHourlyCost,
        user_id: user.id, // Adicionado user_id para satisfazer a política RLS em caso de upsert/insert
      }));

      // Perform batch update
      const { error: updateError } = await supabase
        .from('services')
        .upsert(updates, { onConflict: 'id' }); // Use upsert with onConflict to update existing rows

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', user?.id] }); // Invalidate services query
      toast({
        title: "Serviços atualizados!",
        description: "O custo da hora de trabalho foi atualizado em todos os seus serviços.",
      });
    },
    onError: (err) => {
      console.error("Error updating services labor cost:", err);
      toast({
        title: "Erro ao atualizar serviços",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleAddCost = () => {
    setEditingCost(undefined);
    setNewCostDefaults(undefined);
    setIsFormDialogOpen(true);
  };

  const handleEditCost = (cost: OperationalCost) => {
    setEditingCost(cost);
    setNewCostDefaults(undefined);
    setIsFormDialogOpen(true);
  };

  const handleDeleteCost = (id: string) => {
    deleteCostMutation.mutate(id);
  };

  const handleDayCheckboxToggle = (dayKey: string) => {
    setSelectedDays(prevDays => {
      const newSelectedDays = { ...prevDays, [dayKey]: !prevDays[dayKey] };
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

  // NOVO: Callback para quando um custo é salvo no CostFormDialog
  const handleCostSaved = (savedCost: OperationalCost) => {
    // Recalcular hourlyCost após o salvamento do custo
    queryClient.invalidateQueries({ queryKey: ['operationalCosts', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['operationalHours', user?.id] });
    
    // Use a função de cálculo para obter o valor mais recente
    const currentHourlyCost = calculateHourlyCost();

    if (savedCost.description === 'Produtos Gastos no Mês' && productCostCalculationMethod === 'monthly-average') {
      if (currentHourlyCost > 0) {
        updateServicesLaborCostMutation.mutate(currentHourlyCost);
      } else {
        toast({
          title: "Custo por hora não calculado",
          description: "Não foi possível calcular o custo por hora para atualizar os serviços. Verifique seus custos e horários.",
          variant: "destructive",
        });
      }
    }
  };

  const fixedCosts = operationalCosts?.filter(cost => cost.type === 'fixed') || [];
  const variableCosts = operationalCosts?.filter(cost => cost.type === 'variable') || [];

  const sumFixedCosts = fixedCosts.reduce((sum, cost) => sum + cost.value, 0);
  const sumVariableCosts = variableCosts.reduce((sum, cost) => sum + cost.value, 0);
  const totalMonthlyExpenses = sumFixedCosts + sumVariableCosts;

  const totalWorkingDaysInMonth = Object.values(selectedDays).filter(Boolean).length * 4;

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
        
        if (duration > 60) {
          duration -= 60;
        } else {
          duration = 0;
        }

        if (duration > 0) {
          totalWorkingMinutesPerWeek += duration;
          daysWithActualHours++;
        }
      }
    }
  });

  const averageDailyWorkingHours = daysWithActualHours > 0 ? (totalWorkingMinutesPerWeek / daysWithActualHours) / 60 : 0;
  const dailyCost = totalWorkingDaysInMonth > 0 ? totalMonthlyExpenses / totalWorkingDaysInMonth : 0;
  const hourlyCost = averageDailyWorkingHours > 0 ? dailyCost / averageDailyWorkingHours : 0;

  // Função para calcular o custo por hora (extraída para ser reutilizável)
  const calculateHourlyCost = (): number => {
    if (!operationalCosts || !fetchedOperationalHours) return 0;

    const currentFixedCosts = operationalCosts.filter(cost => cost.type === 'fixed');
    const currentVariableCosts = operationalCosts.filter(cost => cost.type === 'variable');

    const currentSumFixedCosts = currentFixedCosts.reduce((sum, cost) => sum + cost.value, 0);
    const currentSumVariableCosts = currentVariableCosts.reduce((sum, cost) => sum + cost.value, 0);
    const currentTotalMonthlyExpenses = currentSumFixedCosts + currentSumVariableCosts;

    const currentSelectedDays: { [key: string]: boolean } = {};
    daysOfWeek.forEach(day => {
      const startKey = `${day.key}_start` as keyof typeof fetchedOperationalHours;
      const endKey = `${day.key}_end` as keyof typeof fetchedOperationalHours;
      currentSelectedDays[day.key] = !!(fetchedOperationalHours[startKey] || fetchedOperationalHours[endKey]);
    });

    const currentTotalWorkingDaysInMonth = Object.values(currentSelectedDays).filter(Boolean).length * 4;

    let currentTotalWorkingMinutesPerWeek = 0;
    let currentDaysWithActualHours = 0;

    daysOfWeek.forEach(day => {
      if (currentSelectedDays[day.key]) {
        const startKey = `${day.key}_start` as keyof typeof fetchedOperationalHours;
        const endKey = `${day.key}_end` as keyof typeof fetchedOperationalHours;
        const startTime = fetchedOperationalHours[startKey];
        const endTime = fetchedOperationalHours[endKey];

        if (startTime && endTime) {
          const startMinutes = timeToMinutes(startTime);
          const endMinutes = timeToMinutes(endTime);
          let duration = endMinutes - startMinutes;
          
          if (duration > 60) {
            duration -= 60;
          } else {
            duration = 0; 
          }

          if (duration > 0) {
            currentTotalWorkingMinutesPerWeek += duration;
            currentDaysWithActualHours++;
          }
        }
      }
    });

    const currentAverageDailyWorkingHours = currentDaysWithActualHours > 0 ? (currentTotalWorkingMinutesPerWeek / currentDaysWithActualHours) / 60 : 0;
    const currentDailyCost = currentTotalWorkingDaysInMonth > 0 ? currentTotalMonthlyExpenses / currentTotalWorkingDaysInMonth : 0;
    const currentHourlyCost = currentAverageDailyWorkingHours > 0 ? currentDailyCost / currentAverageDailyWorkingHours : 0;

    return currentHourlyCost;
  };


  if (isLoadingCosts || isLoadingHours || isLoadingMonthlyCost || updateServicesLaborCostMutation.isPending) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="ml-2 text-muted-foreground">Carregando custos e horários operacionais...</p>
    </div>
  );
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
            <FixedCostsTable
              costs={fixedCosts}
              onEdit={handleEditCost}
              onDelete={handleDeleteCost}
            />
            <VariableCostsTable
              costs={variableCosts}
              onEdit={handleEditCost}
              onDelete={handleDeleteCost}
            />
          </div>

          <Button 
            onClick={handleAddCost}
            className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Novo Custo
          </Button>

          <OperationalHoursForm
            operationalHours={operationalHours}
            selectedDays={selectedDays}
            onDayToggle={handleDayCheckboxToggle}
            onHourChange={handleHourChange}
            onSaveHours={handleSaveOperationalHours}
            isSaving={upsertOperationalHoursMutation.isPending}
          />

          <CostAnalysisSummary
            sumFixedCosts={sumFixedCosts}
            sumVariableCosts={sumVariableCosts}
            totalMonthlyExpenses={totalMonthlyExpenses}
            dailyCost={dailyCost}
            hourlyCost={hourlyCost}
            totalWorkingDaysInMonth={totalWorkingDaysInMonth}
            averageDailyWorkingHours={averageDailyWorkingHours}
          />
        </CardContent>
      </Card>

      <CostFormDialog
        isOpen={isFormDialogOpen}
        onClose={() => {
          setIsFormDialogOpen(false);
          setNewCostDefaults(undefined);
        }}
        cost={editingCost}
        defaultDescription={newCostDefaults?.description}
        defaultType={newCostDefaults?.type}
        onCostSaved={handleCostSaved} // Passar o callback
      />
    </div>
  );
};

export default ManageCostsPage;