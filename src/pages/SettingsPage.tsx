import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Settings, Mail, Lock, Loader2 } from 'lucide-react';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';

const EmailUpdateForm = () => {
  const { user } = useSession();
  const { toast } = useToast();
  const [newEmail, setNewEmail] = useState(user?.email || '');

  const updateEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      if (!user) throw new Error("Usuário não autenticado.");
      
      const { data, error } = await supabase.auth.updateUser({ email });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "E-mail de confirmação enviado!",
        description: "Verifique sua nova caixa de entrada para confirmar a alteração do e-mail.",
      });
    },
    onError: (err) => {
      toast({
        title: "Erro ao atualizar e-mail",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newEmail === user?.email) {
      toast({
        title: "Nenhuma alteração",
        description: "O novo e-mail é o mesmo que o atual.",
      });
      return;
    }
    if (!newEmail.includes('@')) {
      toast({
        title: "E-mail inválido",
        description: "Por favor, insira um e-mail válido.",
        variant: "destructive",
      });
      return;
    }
    updateEmailMutation.mutate(newEmail);
  };

  return (
    <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 text-primary" />
          <CardTitle className="text-foreground">Alterar E-mail</CardTitle>
        </div>
        <CardDescription>
          Uma confirmação será enviada para o novo endereço de e-mail.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-email">E-mail Atual</Label>
            <Input id="current-email" value={user?.email || ''} disabled className="bg-muted/50" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-email">Novo E-mail</Label>
            <Input 
              id="new-email" 
              type="email" 
              value={newEmail} 
              onChange={(e) => setNewEmail(e.target.value)} 
              className="bg-background" 
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={updateEmailMutation.isPending}>
            {updateEmailMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              "Atualizar E-mail"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

const PasswordUpdateForm = () => {
  const { user } = useSession();
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const updatePasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      if (!user) throw new Error("Usuário não autenticado.");
      
      // Nota: Supabase Auth `updateUser` não requer a senha antiga, apenas a nova.
      const { data, error } = await supabase.auth.updateUser({ password });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Senha atualizada!",
        description: "Sua senha foi alterada com sucesso.",
      });
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err) => {
      toast({
        title: "Erro ao atualizar senha",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({
        title: "Senha muito curta",
        description: "A senha deve ter pelo menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Senhas não conferem",
        description: "A nova senha e a confirmação não são iguais.",
        variant: "destructive",
      });
      return;
    }
    updatePasswordMutation.mutate(newPassword);
  };

  return (
    <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Lock className="h-5 w-5 text-primary" />
          <CardTitle className="text-foreground">Trocar Senha</CardTitle>
        </div>
        <CardDescription>
          Use uma senha forte para proteger sua conta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nova Senha</Label>
            <Input 
              id="new-password" 
              type="password" 
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)} 
              className="bg-background" 
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
            <Input 
              id="confirm-password" 
              type="password" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              className="bg-background" 
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={updatePasswordMutation.isPending}>
            {updatePasswordMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              "Trocar Senha"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

const SettingsPage = () => {
  const { user } = useSession();

  if (!user) {
    return <p className="p-8 text-center">Carregando...</p>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-6 w-6 text-foreground" />
        <h1 className="text-2xl font-bold text-foreground">Configurações da Conta</h1>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EmailUpdateForm />
        <PasswordUpdateForm />
      </div>
    </div>
  );
};

export default SettingsPage;