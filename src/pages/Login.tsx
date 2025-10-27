import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Loader2, Mail, Lock, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Erro no login",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Login realizado!",
          description: "Bem-vindo ao Precifix.",
        });
        navigate('/');
      }
    } catch (error: any) {
      toast({
        title: "Erro inesperado",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({
        title: "E-mail necessário",
        description: "Digite seu e-mail para redefinir a senha.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });

      if (error) {
        toast({
          title: "Erro ao enviar e-mail",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "E-mail enviado!",
          description: "Verifique sua caixa de entrada para redefinir a senha.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro inesperado",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    }
  };

  const handleSignUp = () => {
    navigate('/signup'); // Assumindo que há uma rota /signup; ajuste conforme necessário
  };

  return (
    <div 
      className="flex min-h-screen items-center justify-center p-4 bg-cover bg-center relative"
      style={{ backgroundImage: `url('/login-background.jpg')` }} // Mantenha a imagem de fundo se existir
    >
      {/* Overlay escuro para contraste */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div> 
      
      <Card className="w-full max-w-md bg-black/80 text-white border-gray-800 z-10 relative"> {/* z-10 para ficar acima do overlay */}
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img 
              src="/precifix-logo.png" 
              alt="Precifix Logo" 
              className="h-24 w-auto"
            />
          </div>
          <CardTitle className="text-3xl font-bold text-white">Bem-vindo ao Precifix</CardTitle>
          <CardDescription className="text-gray-300">
            Sistema de gestão facilitada para estética automotiva. Gerencie seus orçamentos e custos de forma simples e eficiente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-left text-sm font-medium text-gray-300">
                Qual seu e-mail?
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-primary focus:ring-primary"
                required
              />
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="password" className="text-left text-sm font-medium text-gray-300">
                Qual sua senha?
              </Label>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 pr-10 focus:border-primary focus:ring-primary"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-9 h-6 w-6 p-0 text-gray-400 hover:text-white"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <Button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                'ENTRAR NA PLATAFORMA'
              )}
            </Button>
          </form>

          {/* Links abaixo do botão */}
          <div className="flex flex-col space-y-3 pt-4">
            <Button
              variant="link"
              onClick={handleForgotPassword}
              className="text-gray-300 hover:text-white p-0 h-auto text-sm justify-start"
              disabled={!email || isLoading}
            >
              <Mail className="h-4 w-4 mr-1 inline" />
              Esqueceu sua senha?
            </Button>
            <Button
              variant="link"
              onClick={handleSignUp}
              className="text-gray-300 hover:text-white p-0 h-auto text-sm justify-start"
            >
              <UserPlus className="h-4 w-4 mr-1 inline" />
              Não tem uma conta? Crie uma
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;