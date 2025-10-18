import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Car, FileText, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  isLoading: boolean;
}

const StatCard = ({ title, value, icon: Icon, isLoading }: StatCardProps) => (
  <Card className="bg-background border-border/50 shadow-sm">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">
        {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : value}
      </div>
    </CardContent>
  </Card>
);

export const DashboardStats = () => {
  const { user } = useSession();

  // Fetch products count
  const { data: productsCount, isLoading: isLoadingProducts } = useQuery<number>({
    queryKey: ['productsCount', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from('product_catalog_items')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  // Fetch services count
  const { data: servicesCount, isLoading: isLoadingServices } = useQuery<number>({
    queryKey: ['servicesCount', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from('services')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  // Fetch quotes count
  const { data: quotesCount, isLoading: isLoadingQuotes } = useQuery<number>({
    queryKey: ['quotesCount', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from('quotes')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <StatCard 
        title="Produtos Cadastrados" 
        value={productsCount} 
        icon={Package} 
        isLoading={isLoadingProducts} 
      />
      <StatCard 
        title="Serviços Oferecidos" 
        value={servicesCount} 
        icon={Car} 
        isLoading={isLoadingServices} 
      />
      <StatCard 
        title="Orçamentos Gerados" 
        value={quotesCount} 
        icon={FileText} 
        isLoading={isLoadingQuotes} 
      />
    </div>
  );
};