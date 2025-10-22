import React, { useState, useEffect, ReactNode } from 'react';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface CollapsibleSectionProps {
  title: string;
  preferenceKey: string; // Chave única para salvar a preferência no banco de dados
  children: ReactNode;
  defaultOpen?: boolean;
  icon: React.ElementType; // Ícone para o título da seção
}

interface UserPreference {
  id: string;
  user_id: string;
  preference_key: string;
  preference_value: { isOpen: boolean };
}

export const CollapsibleSection = ({
  title,
  preferenceKey,
  children,
  defaultOpen = true,
  icon: Icon,
}: CollapsibleSectionProps) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Query para buscar a preferência do usuário
  const { data: userPreference, isLoading: isLoadingPreference } = useQuery<UserPreference | null>({
    queryKey: ['userPreference', user?.id, preferenceKey],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .eq('preference_key', preferenceKey)
        .single();
      if (error && (error as any).code !== 'PGRST116') { // PGRST116 means no rows found
        console.error(`Error fetching user preference for ${preferenceKey}:`, error);
        throw error;
      }
      return data;
    },
    enabled: !!user,
  });

  // Efeito para carregar a preferência inicial
  useEffect(() => {
    if (!isLoadingPreference && userPreference !== undefined && isInitialLoad) {
      if (userPreference) {
        setIsOpen(userPreference.preference_value.isOpen);
      } else {
        // Se não houver preferência, salvar o defaultOpen
        upsertPreferenceMutation.mutate({ isOpen: defaultOpen });
      }
      setIsInitialLoad(false);
    }
  }, [userPreference, isLoadingPreference, isInitialLoad, defaultOpen]);

  // Mutação para salvar/atualizar a preferência do usuário
  const upsertPreferenceMutation = useMutation({
    mutationFn: async (value: { isOpen: boolean }) => {
      if (!user) throw new Error("Usuário não autenticado.");

      const preferenceToSave = {
        user_id: user.id,
        preference_key: preferenceKey,
        preference_value: value,
      };

      if (userPreference?.id) {
        // Update existing preference
        const { data, error } = await supabase
          .from('user_preferences')
          .update(preferenceToSave)
          .eq('id', userPreference.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        // Insert new preference
        const { data, error } = await supabase
          .from('user_preferences')
          .insert(preferenceToSave)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPreference', user?.id, preferenceKey] });
    },
    onError: (err) => {
      console.error(`Error saving preference for ${preferenceKey}:`, err);
      toast({
        title: "Erro ao salvar preferência",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    upsertPreferenceMutation.mutate({ isOpen: newState });
  };

  if (isLoadingPreference) {
    return (
      <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5 text-primary" />
            <CardTitle className="text-foreground">{title}</CardTitle>
          </div>
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardHeader>
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={handleToggle} className="space-y-2">
      <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5 text-primary" />
            <CardTitle className="text-foreground">{title}</CardTitle>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:bg-muted/50">
              {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </Button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent className="CollapsibleContent">
          <CardContent className="pt-4">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};