import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Gauge } from 'lucide-react'; // Importar o ícone Gauge

function Login() {
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
              <h2 className="text-3xl font-bold text-foreground">PrecifiCar</h2>
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-foreground">Bem-vindo de volta!</CardTitle>
          <CardDescription className="text-muted-foreground">
            Faça login ou crie uma conta para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Auth
            supabaseClient={supabase}
            providers={[]}
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
          {/* Bloco de estilo para forçar a cor do texto */}
          <style>{`
            .supabase-auth-ui_ui-button {
              color: black !important;
            }
            .supabase-auth-ui_ui-anchor {
              color: black !important;
            }
          `}</style>
        </CardContent>
      </Card>
    </div>
  );
}

export default Login;