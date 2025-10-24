import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Gauge } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc'; // Importando o ícone oficial do Google

function Login() {
  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      console.error('Erro ao fazer login com Google:', error.message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md bg-gray-900 text-white shadow-[var(--shadow-elegant)] border-gray-700">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img 
              src="/precifix-logo.png" 
              alt="Precifix Logo" 
              className="h-20 w-auto" 
              style={{ filter: 'drop-shadow(0 0 5px rgba(255, 255, 255, 0.2))' }}
            />
          </div>
          <CardTitle className="text-3xl font-bold text-white">Bem-vindo de volta!</CardTitle>
          <CardDescription className="text-gray-400">
            Faça login ou crie uma conta para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Auth
            supabaseClient={supabase}
            providers={[]}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    // Cores para o tema escuro
                    brand: 'hsl(var(--primary))',
                    brandAccent: 'hsl(var(--primary-glow))',
                    inputBackground: 'hsl(0 0% 15%)', // Fundo do input escuro
                    inputBorder: 'hsl(0 0% 30%)',
                    inputBorderHover: 'hsl(var(--primary))',
                    inputBorderFocus: 'hsl(var(--primary))',
                    inputText: 'hsl(0 0% 90%)', // Texto do input claro
                    defaultButtonBackground: 'hsl(var(--primary))',
                    defaultButtonBackgroundHover: 'hsl(var(--primary-glow))',
                    defaultButtonBorder: 'hsl(var(--primary))',
                    dividerBackground: 'hsl(0 0% 30%)',
                    // Cores de fundo e texto do Auth UI
                    defaultButtonText: 'hsl(0 0% 0%)', // Texto do botão primário preto
                    defaultButtonBackground: 'hsl(var(--primary))',
                    defaultButtonBackgroundHover: 'hsl(var(--primary-glow))',
                    messageText: 'hsl(0 0% 90%)', // Texto de mensagens
                    anchorText: 'hsl(var(--primary))', // Links
                  },
                },
              },
            }}
            theme="dark" // Força o tema escuro
            localization={{
              variables: {
                sign_in: {
                  email_label: 'Seu e-mail',
                  password_label: 'Sua senha',
                  email_input_placeholder: 'email@exemplo.com',
                  password_input_placeholder: '••••••••',
                  button_label: 'Entrar',
                  social_provider_text: 'Ou continue com',
                  link_text: 'Já tem uma conta? Entrar',
                },
                sign_up: {
                  email_label: 'Seu e-mail',
                  password_label: 'Crie uma senha',
                  email_input_placeholder: 'email@exemplo.com',
                  password_input_placeholder: '••••••••',
                  button_label: 'Criar conta',
                  social_provider_text: 'Ou continue com',
                  link_text: 'Não tem uma conta? Cadastre-se',
                },
                forgotten_password: {
                  email_label: 'Seu e-mail',
                  email_input_placeholder: 'email@exemplo.com',
                  button_label: 'Enviar instruções de recuperação',
                  link_text: 'Esqueceu sua senha?',
                },
                update_password: {
                  password_label: 'Nova senha',
                  password_input_placeholder: '••••••••',
                  button_label: 'Atualizar senha',
                },
                magic_link: {
                  email_input_placeholder: 'email@exemplo.com',
                  button_label: 'Enviar link mágico',
                  link_text: 'Enviar link mágico',
                },
              },
            }}
          />
          <Button
            onClick={handleGoogleLogin}
            className="w-full bg-white border border-gray-300 text-foreground hover:bg-gray-50 transition-colors flex items-center justify-center"
            variant="outline"
          >
            <FcGoogle className="mr-2 h-5 w-5" />
            Logar com Google
          </Button>
          <style>{`
            /* Sobrescreve estilos para garantir que o fundo do Auth UI seja escuro */
            .supabase-auth-ui_ui-card {
              background-color: transparent !important;
              box-shadow: none !important;
            }
            .supabase-auth-ui_ui-button {
              color: black !important;
            }
            .supabase-auth-ui_ui-anchor {
              color: hsl(var(--primary)) !important;
            }
            .supabase-auth-ui_ui-button:not([data-provider]) {
              background-color: hsl(var(--primary)) !important;
              border-color: hsl(var(--primary)) !important;
              color: hsl(var(--primary-foreground)) !important;
            }
            .supabase-auth-ui_ui-button:not([data-provider]):hover {
              background-color: hsl(var(--primary-glow)) !important;
            }
          `}</style>
        </CardContent>
      </Card>
    </div>
  );
}

export default Login;