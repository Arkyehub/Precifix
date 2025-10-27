import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Settings, Mail, Lock, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { ProductCostCalculationMethod } from '@/components/settings/ProductCostCalculationMethod'; // Importar o novo componente

// Regex para validar senha forte:
// (?=.*[a-z]) - Pelo menos uma letra minúscula
// (?=.*[A-Z]) - Pelo menos uma letra maiúscula
// (?=.*\d) - Pelo menos um dígito
// (?=.*[!@#$%^&*()_+[\]{};':"\\|,.<>/?]) - Pelo menos um caractere especial comum
// .{8,} - Mínimo de 8 caracteres
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+[\]{};':"\\|,.<>/?]).{8,}$/;

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

  const isPasswordLongEnough = newPassword.length >= 8;
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasLowerCase = /[a-z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const hasSpecialChar = /[!@#$%^&*()_+[\]{};':"\\|,.<>/?]/.test(newPassword);

  const isPasswordStrong = isPasswordLongEnough && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;
  const passwordsMatch = newPassword === confirmPassword;

  const updatePasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      if (!user) throw new Error("Usuário não autenticado.");
      
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

  const isButtonDisabled = updatePasswordMutation.isPending || !isPasswordStrong || !passwordsMatch || newPassword.length === 0;

  // Calculate password strength for the progress bar
  const calculateStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength += 20;
    if (/[A-Z]/.test(password)) strength += 20;
    if (/[a-z]/.test(password)) strength += 20;
    if (/\d/.test(password)) strength += 20;
    if (/[!@#$%^&*()_+[\]{};':"\\|,.<>/?]/.test(password)) strength += 20;
    return Math.min(strength, 100); // Cap at 100%
  };

  const passwordStrength = calculateStrength(newPassword);

  const getProgressBarColor = (strength: number) => {
    if (strength < 40) return "bg-destructive";
    if (strength < 70) return "bg-accent"; // Using accent for medium strength
    return "bg-success"; // Using success for strong
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isPasswordStrong) {
      toast({
        title: "Senha fraca",
        description: "A nova senha não atende aos requisitos de segurança.",
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

  const PasswordRequirement = ({ condition, text }: { condition: boolean, text: string }) => (
    <div className={`flex items-center text-sm ${condition ? 'text-success' : 'text-destructive'}`}>
      {condition ? <CheckCircle className="h-4 w-4 mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
      {text}
    </div>
  );

  // Função para renderizar o conteúdo do tooltip
  const renderPasswordRequirementsTooltipContent = () => (
    <TooltipContent className="bg-card text-foreground border border-border/50 p-3 rounded-lg shadow-md">
      <p className="text-sm font-medium mb-2">Requisitos de Senha Forte:</p>
      <PasswordRequirement 
        condition={isPasswordLongEnough} 
        text="Mínimo de 8 caracteres" 
      />
      <PasswordRequirement 
        condition={hasUpperCase} 
        text="Pelo menos uma letra maiúscula" 
      />
      <PasswordRequirement 
        condition={hasLowerCase} 
        text="Pelo menos uma letra minúscula" 
      />
      <PasswordRequirement 
        condition={hasNumber} 
        text="Pelo menos um número" 
      />
      <PasswordRequirement 
        condition={hasSpecialChar} 
        text="Pelo menos um caractere especial" 
      />
    </TooltipContent>
  );

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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
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
                </TooltipTrigger>
                {renderPasswordRequirementsTooltipContent()}
              </Tooltip>
            </TooltipProvider>
            {/* Régua de Força de Senha - Ajustada para ficar mais próxima */}
            <Progress value={passwordStrength} className="h-2 mt-1" indicatorClassName={getProgressBarColor(passwordStrength)} />
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
          
          {/* Tooltip condicional para o botão */}
          {isButtonDisabled ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* Envolve o botão desabilitado em um span para permitir que o tooltip seja acionado */}
                  <span className="w-full">
                    <Button 
                      type="submit" 
                      className="w-full pointer-events-none mt-6" // Adicionado mt-6 aqui
                      disabled={isButtonDisabled}
                    >
                      {updatePasswordMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        "Trocar Senha"
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                {renderPasswordRequirementsTooltipContent()}
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Button 
              type="submit" 
              className="w-full mt-6" // Adicionado mt-6 aqui
              disabled={isButtonDisabled}
            >
              {updatePasswordMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Trocar Senha"
              )}
            </Button>
          )}
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
      <div className="mt-8"> {/* Nova seção para o método de cálculo */}
        <ProductCostCalculationMethod />
      </div>
    </div>
  );
};

export default SettingsPage;