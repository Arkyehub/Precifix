import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileText, Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QuotedService } from "./QuoteServiceFormDialog";
import { PaymentMethod } from "./PaymentMethodFormDialog"; // Importar PaymentMethod

interface QuoteGeneratorProps {
  selectedServices: QuotedService[];
  totalCost: number;
  finalPrice: number; // Este agora é o valueAfterDiscount
  executionTime: number;
  calculatedDiscount: number; // Novo prop
  currentPaymentMethod: PaymentMethod | undefined; // Novo prop
  selectedInstallments: number | null; // Novo prop
}

export const QuoteGenerator = ({ 
  selectedServices, 
  totalCost, 
  finalPrice, // Este é o valor após o desconto, antes da taxa de pagamento
  executionTime,
  calculatedDiscount,
  currentPaymentMethod,
  selectedInstallments,
}: QuoteGeneratorProps) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Função auxiliar para obter a data de hoje no formato YYYY-MM-DD (local)
  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [clientName, setClientName] = useState("");
  const [quoteDate, setQuoteDate] = useState(getTodayDateString()); // Usar a função auxiliar
  const [vehicle, setVehicle] = useState("");
  const [observations, setObservations] = useState("");

  const saveQuoteMutation = useMutation({
    mutationFn: async (quoteData: {
      client_name: string;
      vehicle: string;
      total_price: number;
      quote_date: string;
      services_summary: any[];
    }) => {
      if (!user) throw new Error("Usuário não autenticado.");

      const { data, error } = await supabase
        .from('quotes')
        .insert({
          user_id: user.id,
          client_name: quoteData.client_name,
          vehicle: quoteData.vehicle,
          total_price: quoteData.total_price,
          quote_date: quoteData.quote_date,
          services_summary: quoteData.services_summary,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotesCalendar', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['quotesCount', user?.id] });
      toast({
        title: "Orçamento salvo!",
        description: "O orçamento foi salvo e está disponível no Painel Principal.",
      });
    },
    onError: (err) => {
      toast({
        title: "Erro ao salvar orçamento",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const generatePDF = async () => {
    if (!clientName || !vehicle) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha o nome do cliente e o veículo.",
        variant: "destructive",
      });
      return;
    }

    // Prepare services summary for PDF and DB
    const servicesSummaryForPdf = selectedServices.map(service => ({
      name: service.name,
      price: service.quote_price ?? service.price,
      execution_time_minutes: service.quote_execution_time_minutes ?? service.execution_time_minutes,
    }));

    // Save quote to database
    await saveQuoteMutation.mutateAsync({
      client_name: clientName,
      vehicle: vehicle,
      total_price: finalPrice, // Usar finalPrice (que é valueAfterDiscount) para o total do orçamento
      quote_date: quoteDate,
      services_summary: servicesSummaryForPdf,
    });

    const doc = new jsPDF();
    let yPosition = 20;

    // Cabeçalho
    doc.setFillColor(255, 204, 0); // Amarelo dourado
    doc.rect(0, 0, 210, 40, 'F');
    
    // Imagem de perfil do usuário (avatar)
    const userAvatarUrl = user?.user_metadata?.avatar_url;
    if (userAvatarUrl) {
      try {
        const img = new Image();
        img.src = userAvatarUrl;
        img.onload = () => {
          const imgWidth = 25;
          const imgHeight = 25;
          const x = 210 - 15 - imgWidth; // 15mm da direita
          doc.addImage(img, 'JPEG', x, 10, imgWidth, imgHeight);
        };
      } catch (e) {
        console.error("Erro ao adicionar avatar do usuário", e);
      }
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text("ORÇAMENTO", 15, 25);
    
    doc.setFontSize(10);
    // Criar um objeto Date localmente a partir da string YYYY-MM-DD para evitar problemas de fuso horário
    const [yearStr, monthStr, dayStr] = quoteDate.split('-');
    const displayDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(dayStr));
    doc.text(`Data: ${displayDate.toLocaleDateString('pt-BR')}`, 15, 35);

    yPosition = 55;
    doc.setTextColor(0, 0, 0);

    // Dados do Cliente
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text("Dados do Cliente", 15, yPosition);
    yPosition += 8;

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(`Cliente: ${clientName}`, 15, yPosition);
    yPosition += 6;
    doc.text(`Veículo: ${vehicle}`, 15, yPosition);
    yPosition += 12;

    // Serviços Selecionados
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text("Serviços Contratados", 15, yPosition);
    yPosition += 8;

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    
    // Cabeçalho da tabela
    doc.setFillColor(240, 240, 240);
    doc.rect(15, yPosition - 5, 180, 8, 'F');
    doc.text("Serviço", 20, yPosition);
    doc.text("Tempo", 120, yPosition);
    doc.text("Valor", 160, yPosition);
    yPosition += 10;

    // Lista de serviços
    servicesSummaryForPdf.forEach((service, index) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
      
      doc.text(service.name, 20, yPosition);
      doc.text(`${service.execution_time_minutes} min`, 120, yPosition);
      doc.text(`R$ ${service.price.toFixed(2)}`, 160, yPosition);
      
      if (index < servicesSummaryForPdf.length - 1) {
        doc.setDrawColor(220, 220, 220);
        doc.line(15, yPosition + 5, 195, yPosition + 5); // Desenha a linha 5 unidades abaixo do texto
        yPosition += 12; // Incrementa yPosition para o próximo texto + espaço da linha
      } else {
        yPosition += 7; // Para o último item, apenas incrementa para o próximo bloco
      }
    });

    yPosition += 8;

    // Seção de Desconto
    if (calculatedDiscount > 0) {
      if (yPosition > 270) { doc.addPage(); yPosition = 20; }
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text("Desconto Aplicado:", 15, yPosition);
      doc.setFont(undefined, 'normal');
      doc.text(`- R$ ${calculatedDiscount.toFixed(2)}`, 160, yPosition, { align: 'right' });
      yPosition += 10;
    }

    // Seção de Forma de Pagamento
    if (currentPaymentMethod) {
      if (yPosition > 270) { doc.addPage(); yPosition = 20; }
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text("Forma de Pagamento:", 15, yPosition);
      doc.setFont(undefined, 'normal');
      let paymentMethodText = currentPaymentMethod.name;

      if (currentPaymentMethod.type === 'credit_card' && selectedInstallments) {
        const installmentDetails = currentPaymentMethod.installments?.find(inst => inst.installments === selectedInstallments);
        if (installmentDetails) {
          paymentMethodText = `Cartão de Crédito em até ${selectedInstallments}x `;
          if (installmentDetails.rate === 0) {
            paymentMethodText += "(sem juros)";
          }
        }
      }
      doc.text(paymentMethodText, 160, yPosition, { align: 'right' });
      yPosition += 10;
    }

    // Total
    doc.setFillColor(255, 204, 0); // Amarelo dourado
    doc.rect(15, yPosition - 5, 180, 12, 'F');
    doc.setTextColor(0, 0, 0); // Texto preto para contraste
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(`VALOR TOTAL: R$ ${finalPrice.toFixed(2)}`, 20, yPosition + 3); // Usar finalPrice (valueAfterDiscount)
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');
    yPosition += 20;

    // Observações
    if (observations) {
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text("Observações:", 15, yPosition);
      yPosition += 7;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      const splitObs = doc.splitTextToSize(observations, 180);
      doc.text(splitObs, 15, yPosition);
      yPosition += splitObs.length * 5 + 10;
    }

    // Rodapé
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const footerY = 280;
    doc.text("Agradecemos pela preferência! Qualquer dúvida, estamos à disposição.", 105, footerY, { align: 'center' });

    // Salvar PDF
    doc.save(`orcamento_${clientName.replace(/\s+/g, '_')}_${quoteDate}.pdf`);
    
    toast({
      title: "PDF gerado com sucesso!",
      description: "O orçamento foi baixado para seu dispositivo.",
    });
  };


  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 shadow-[var(--shadow-elegant)]">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg">
            <FileText className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-foreground">Gerar Orçamento para Cliente</CardTitle>
            <CardDescription>
              Preço justo, lucro certo — o sucesso começa na precificação.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="clientName">Nome do Cliente *</Label>
            <Input
              id="clientName"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Ex: João Silva"
              className="bg-background/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quoteDate">Data do Orçamento</Label>
            <Input
              id="quoteDate"
              type="date"
              value={quoteDate}
              onChange={(e) => setQuoteDate(e.target.value)}
              className="bg-background/50"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="vehicle">Veículo (Marca/Modelo) *</Label>
            <Input
              id="vehicle"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              placeholder="Ex: Honda Civic 2020"
              className="bg-background/50"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="observations">Observações Adicionais</Label>
            <Textarea
              id="observations"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Informações extras, condições de pagamento, garantia, etc."
              className="bg-background/50 min-h-[100px]"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-border/50">
          <div className="bg-background rounded-lg p-4 mb-4 shadow-md">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Serviços Selecionados:</span>
              <span className="font-semibold text-foreground">{selectedServices.length}</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm text-muted-foreground">Tempo Estimado:</span>
              <span className="font-semibold text-foreground">{executionTime} minutos</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-lg font-bold text-foreground">Valor Total:</span>
              <span className="text-2xl font-bold text-primary">R$ {finalPrice.toFixed(2)}</span> {/* Este é o valor após o desconto */}
            </div>
          </div>

          <Button 
            onClick={generatePDF}
            className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
            disabled={saveQuoteMutation.isPending}
          >
            {saveQuoteMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {saveQuoteMutation.isPending ? "Gerando e Salvando..." : "Gerar PDF e Salvar Orçamento"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center italic">
          Seu orçamento está pronto para impressionar o cliente! 🚗✨
        </p>
      </CardContent>
    </Card>
  );
};