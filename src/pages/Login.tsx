import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button'; // Adicionado import do Button
import { Gauge, Globe } from 'lucide-react'; // Importar o ícone Gauge e Globe (substituído Google por Globe)

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
      <Card className="w-full max-w-md bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)] border-border/50">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {/* Substituído a imagem pelo ícone e texto */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg shadow-[var(--shadow-elegant)]">
                <Gauge className="h-8 w-8 text-primary-foreground" />
              </div>
              <h2 className="text-3xl font-bold text-foreground">Precimetro</h2>
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-foreground">Bem-vindo de volta!</CardTitle>
          <CardDescription className="text-muted-foreground">
            Faça login ou crie uma conta para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Auth
            supabaseClient={supabase}
            providers={[]} // Removido providers para esconder os botões padrão
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: 'hsl(var(--primary))',
                    brandAccent: 'hsl(var(--primary-glow))',
                    inputBackground: 'hsl(var(--background))',
                    inputBorder: 'hsl(var(--border))',
                    inputBorderHover: 'hsl(var(--primary))',
                    inputBorderFocus: 'hsl(var(--primary))',
                    inputText: 'hsl(var(--foreground))',
                    defaultButtonBackground: 'hsl(var(--primary))', // Fundo do botão primário
                    defaultButtonBackgroundHover: 'hsl(var(--primary-glow))', // Fundo do botão primário ao passar o mouse
                    defaultButtonBorder: 'hsl(var(--primary))', // Borda do botão primário
                    // defaultButtonText e anchorTextColor serão sobrescritos pelo CSS abaixo
                    dividerBackground: 'hsl(var(--border))',
                  },
                },
              },
            }}
            theme="light"
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
          {/* Botão personalizado do Google abaixo do formulário */}
          <Button
            onClick={handleGoogleLogin}
            className="w-full bg-white border border-primary text-foreground hover:bg-primary/5 transition-colors"
            variant="outline"
          >
            <Globe className="mr-2 h-4 w-4" />
            Logar com Google
          </Button>
          {/* Bloco de estilo para forçar a cor do texto e do botão primário */}
          <style>{`
            .supabase-auth-ui_ui-button {
              color: black !important;
            }
            .supabase-auth-ui_ui-anchor {
              color: black !important;
            }
            /* Estilo para o botão primário "Entrar" */
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