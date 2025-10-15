import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { User as UserIcon } from 'lucide-react';
import { useSession } from '@/components/SessionContextProvider';

const ProfilePage = () => {
  const { user } = useSession();

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 shadow-[var(--shadow-elegant)]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg">
              <UserIcon className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-foreground">Meu Perfil</CardTitle>
              <CardDescription>
                Gerencie suas informações de perfil.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Olá, {user?.user_metadata?.first_name || 'Usuário'}!
          </p>
          <p className="text-sm text-muted-foreground">
            Email: <span className="font-medium text-foreground">{user?.email}</span>
          </p>
          {/* Adicione mais campos do perfil aqui conforme necessário */}
          <p className="text-sm text-muted-foreground italic">
            Esta é uma página placeholder. Funcionalidades de edição de perfil serão adicionadas em breve.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;