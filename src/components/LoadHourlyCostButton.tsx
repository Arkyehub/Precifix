import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useQuery } from '@tanstack/react-query';

interface LoadHourlyCostButtonProps {
  onLoad: (hourlyCost: number) => void;
}

interface OperationalCost {
  id: string;
  description: string;
  value: number;
  type: 'fixed' | 'variable';
  user_id: string;
  created_at: string;
}

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

const daysOfWeek = [
  { key: 'monday', label: 'Seg' },
  { key: 'tuesday', label: 'Ter' },
  { key: 'wednesday', label: 'Qua' },
  { key: 'thursday', label: 'Qui' },
  { key: 'friday', label: 'Sex' },
  { key: 'saturday', label: 'Sáb' },
  { key: 'sunday', label: 'Dom' },
];

const timeToMinutes = (time: string): number => {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export const LoadHourlyCostButton = ({ onLoad }: LoadHourlyCostButtonProps) => {
  const { user } = useSession();
  const { toast } = useToast();

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

  const calculateHourlyCost = () => {
    if (!operationalCosts || !fetchedOperationalHours) return 0;

    const fixedCosts = operationalCosts.filter(cost => cost.type === 'fixed');
    const variableCosts = operationalCosts.filter(cost => cost.type === 'variable');

    const sumFixedCosts = fixedCosts.reduce((sum, cost) => sum + cost.value, 0);
    const sumVariableCosts = variableCosts.reduce((sum, cost) => sum + cost.value, 0);
    const totalMonthlyExpenses = sumFixedCosts + sumVariableCosts;

    const selectedDays: { [key: string]: boolean } = {};
    daysOfWeek.forEach(day => {
      const startKey = `${day.key}_start` as keyof typeof fetchedOperationalHours;
      const endKey = `${day.key}_end` as keyof typeof fetchedOperationalHours;
      selectedDays[day.key] = !!(fetchedOperationalHours[startKey] || fetchedOperationalHours[endKey]);
    });

    const totalWorkingDaysInMonth = Object.values(selectedDays).filter(Boolean).length * 4; // Assuming 4 weeks in a month

    let totalWorkingMinutesPerWeek = 0;
    let daysWithActualHours = 0;

    daysOfWeek.forEach(day => {
      if (selectedDays[day.key]) {
        const startKey = `${day.key}_start` as keyof typeof fetchedOperationalHours;
        const endKey = `${day.key}_end` as keyof typeof fetchedOperationalHours;
        const startTime = fetchedOperationalHours[startKey];
        const endTime = fetchedOperationalHours[endKey];

        if (startTime && endTime) {
          const startMinutes = timeToMinutes(startTime);
          const endMinutes = timeToMinutes(endTime);
          let duration = endMinutes - startMinutes;
          
          if (duration > 60) { // Subtract 1 hour (60 minutes) for lunch if duration is more than 1 hour
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

    return hourlyCost;
  };

  const handleLoadClick = () => {
    if (isLoadingCosts || isLoadingHours) {
      toast({
        title: "Carregando dados...",
        description: "Aguarde enquanto buscamos seus custos operacionais.",
      });
      return;
    }
    if (costsError || hoursError) {
      toast({
        title: "Erro ao carregar custo por hora",
        description: "Não foi possível buscar os dados de custos ou horários. Verifique a página 'Gerenciar Custos'.",
        variant: "destructive",
      });
      return;
    }

    const calculatedCost = calculateHourlyCost();
    if (calculatedCost > 0) {
      onLoad(calculatedCost);
      toast({
        title: "Custo por hora carregado!",
        description: `R$ ${calculatedCost.toFixed(2)} foi adicionado ao campo.`,
      });
    } else {
      toast({
        title: "Custo por hora não disponível",
        description: "Certifique-se de ter custos e horários operacionais configurados na página 'Gerenciar Custos'.",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      type="button"
      variant="default"
      size="icon"
      onClick={handleLoadClick}
      disabled={isLoadingCosts || isLoadingHours}
      title="Carregar Custo por Hora da Análise de Custos"
      className="bg-primary text-primary-foreground hover:bg-primary-glow rounded-l-none" // Adicionado estilo para botão anexado
    >
      {isLoadingCosts || isLoadingHours ? (
        <RefreshCw className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
    </Button>
  );
};