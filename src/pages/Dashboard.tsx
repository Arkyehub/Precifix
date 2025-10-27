import React, { useState, useEffect, useCallback } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { ServiceProfitabilityChart } from '@/components/dashboard/ServiceProfitabilityChart';
import { QuotesCalendar } from '@/components/dashboard/QuotesCalendar';
import { DashboardAnnualSummary } from '@/components/dashboard/DashboardAnnualSummary';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { DraggableCollapsibleSection } from '@/components/DraggableCollapsibleSection'; // Importar o novo componente
import { Gauge, BarChart2, DollarSign, FileText, Car } from 'lucide-react';
import { useSession } from '@/components/SessionContextProvider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react'; // Importar Loader2

interface UserPreference {
  id: string;
  user_id: string;
  preference_key: string;
  preference_value: { order?: string[]; isOpen?: boolean }; // Atualizado para permitir 'order'
}

const DEFAULT_SECTION_ORDER = [
  'dashboardStats',
  'serviceProfitabilityChart',
  'dashboardAnnualSummary',
  'quotesCalendar',
];

const sectionComponents: { [key: string]: { component: React.ElementType; title: string; icon: React.ElementType; defaultOpen: boolean } } = {
  dashboardStats: { component: DashboardStats, title: "Estatísticas Rápidas", icon: BarChart2, defaultOpen: true },
  serviceProfitabilityChart: { component: ServiceProfitabilityChart, title: "Lucratividade dos Serviços", icon: DollarSign, defaultOpen: true },
  dashboardAnnualSummary: { component: DashboardAnnualSummary, title: "Resultado Anual", icon: BarChart2, defaultOpen: true },
  quotesCalendar: { component: QuotesCalendar, title: "Orçamentos no Calendário", icon: FileText, defaultOpen: true },
};

const Dashboard = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [sectionOrder, setSectionOrder] = useState<string[]>(DEFAULT_SECTION_ORDER);

  // Fetch saved order preference
  const { data: savedOrderPreference, isLoading: isLoadingOrderPreference } = useQuery<UserPreference | null>({
    queryKey: ['userPreference', user?.id, 'dashboardSectionOrder'],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .eq('preference_key', 'dashboardSectionOrder')
        .single();
      if (error && (error as any).code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
  });

  // Initialize section order from saved preference or default
  useEffect(() => {
    if (!isLoadingOrderPreference && savedOrderPreference !== undefined) {
      if (savedOrderPreference && Array.isArray(savedOrderPreference.preference_value.order)) {
        // Filter out any old/invalid keys and ensure all default keys are present
        const validOrder = savedOrderPreference.preference_value.order.filter((key: string) =>
          Object.keys(sectionComponents).includes(key)
        );
        const missingDefaults = Object.keys(sectionComponents).filter((key) => !validOrder.includes(key));
        setSectionOrder([...validOrder, ...missingDefaults]);
      } else {
        setSectionOrder(DEFAULT_SECTION_ORDER);
        // Also save the default order if none exists
        upsertOrderPreferenceMutation.mutate({ order: DEFAULT_SECTION_ORDER });
      }
    }
  }, [isLoadingOrderPreference, savedOrderPreference]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mutation to save/update order preference
  const upsertOrderPreferenceMutation = useMutation({
    mutationFn: async (order: { order: string[] }) => {
      if (!user) throw new Error("Usuário não autenticado.");
      const preferenceToSave = {
        user_id: user.id,
        preference_key: 'dashboardSectionOrder',
        preference_value: order,
      };
      if (savedOrderPreference?.id) {
        const { error } = await supabase
          .from('user_preferences')
          .update(preferenceToSave)
          .eq('id', savedOrderPreference.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_preferences')
          .insert(preferenceToSave);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPreference', user?.id, 'dashboardSectionOrder'] });
    },
    onError: (err) => {
      console.error("Error saving section order:", err);
      toast({ title: "Erro ao salvar ordem das seções", description: err.message, variant: "destructive" });
    },
  });

  const moveSection = useCallback((dragIndex: number, hoverIndex: number) => {
    setSectionOrder((prevOrder) => {
      const newOrder = [...prevOrder];
      const [draggedItem] = newOrder.splice(dragIndex, 1);
      newOrder.splice(hoverIndex, 0, draggedItem);
      upsertOrderPreferenceMutation.mutate({ order: newOrder }); // Save new order
      return newOrder;
    });
  }, [upsertOrderPreferenceMutation]);

  if (isLoadingOrderPreference) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Carregando layout do painel...</p>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="px-4 py-8 space-y-8">
        <div className="flex items-center gap-3 mb-6">
          <Gauge className="h-6 w-6 text-foreground" />
          <h1 className="text-2xl font-bold text-foreground">Painel Principal Precifix</h1>
        </div>

        {sectionOrder.map((key, index) => {
          const { component: Component, title, icon, defaultOpen } = sectionComponents[key];
          return (
            <DraggableCollapsibleSection
              key={key}
              id={key}
              index={index}
              moveSection={moveSection}
              title={title}
              preferenceKey={key}
              defaultOpen={defaultOpen}
              icon={icon}
            >
              <Component />
            </DraggableCollapsibleSection>
          );
        })}
      </div>
    </DndProvider>
  );
};

export default Dashboard;