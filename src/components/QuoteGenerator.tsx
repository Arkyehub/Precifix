import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileText, Download, Loader2, Phone, MapPin, Send } from "lucide-react"; // Importar Send
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { QuotedService } from "./QuoteServiceFormDialog";
import { PaymentMethod } from "./PaymentMethodFormDialog";
import { formatPhoneNumber } from '@/lib/utils';

// Interface para os dados do perfil, para uso interno neste componente
interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  document_number: string | null;
  address: string | null;
  address_number: string | null;
  zip_code: string | null;
  phone_number: string | null;
  avatar_url: string | null;
}

interface QuoteGeneratorProps {
  selectedServices: QuotedService[];
  totalCost: number;
  finalPrice: number; // Este agora é o valueAfterDiscount
  executionTime: number;
  calculatedDiscount: number; // Novo prop
  currentPaymentMethod: PaymentMethod | undefined; // Novo prop
  selectedInstallments: number | null; // Novo prop
}

// Função auxiliar para obter a URL da imagem como Data URL (base64)
const getImageDataUrl = async (url: string | null): Promise<string | null> => {
  if (!url) return null;
  try {
    const response = await fetch(url, { mode: 'cors' });
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Erro ao buscar ou converter imagem para Data URL:", error);
    return null;
  }
};

// Função para gerar o PDF como um Blob
const createQuotePdfBlob = async (
  clientName: string,
  vehicle: string,
  quoteDate: string,
  selectedServices: QuotedService[],
  finalPrice: number,
  calculatedDiscount: number,
  currentPaymentMethod: PaymentMethod | undefined,
  selectedInstallments: number | null,
  observations: string,
  profile: Profile | undefined,
  showPhoneNumberField: boolean,
  rawPhoneNumber: string,
  showAddressField: boolean,
  address: string,
): Promise<Blob> => {
  const doc = new jsPDF();
  let yPosition = 20;

  // Cabeçalho
  doc.setFillColor(255, 204, 0); // Amarelo dourado
  doc.rect(0, 0, 210, 40, 'F');
  
  // Imagem de perfil do usuário (avatar)
  const avatarDataUrl = await getImageDataUrl(profile?.avatar_url);
  if (avatarDataUrl) {
    const imgWidth = 25;
    const imgHeight = 25;
    const x = 210 - 15 - imgWidth; // 15mm da direita
    doc.addImage(avatarDataUrl, 'JPEG', x, 10, imgWidth, imgHeight);
  }
  
  doc.setTextColor(0, 0, 0); // Definir cor do texto para preto
  doc.setFontSize(24);
  doc.text("ORÇAMENTO", 15, 25);
  
  doc.setFontSize(10);
  const [yearStr, monthStr, dayStr] = quoteDate.split('-');
  const displayDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(dayStr));
  doc.text(`Data: ${displayDate.toLocaleDateString('pt-BR')}`, 15, 35);

  // Nome da Empresa
  if (profile?.company_name) {
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(profile.company_name, 15, 15);
  }

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
  yPosition += 6;

  if (showPhoneNumberField && rawPhoneNumber.trim()) {
    doc.text(`Telefone: ${formatPhoneNumber(rawPhoneNumber)}`, 15, yPosition);
    yPosition += 6;
  }

  if (showAddressField && address.trim()) {
    doc.text(`Endereço: ${address}`, 15, yPosition);
    yPosition += 6;
  }

  yPosition += 6;

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

  const servicesSummaryForPdf = selectedServices.map(service => ({
    name: service.name,
    price: service.quote_price ?? service.price,
    execution_time_minutes: service.quote_execution_time_minutes ?? service.execution_time_minutes,
  }));

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
      doc.line(15, yPosition + 5, 195, yPosition + 5);
      yPosition += 12;
    } else {
      yPosition += 7;
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
  doc.setFillColor(255, 204, 0);
  doc.rect(15, yPosition - 5, 180, 12, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(`VALOR TOTAL: R$ ${finalPrice.toFixed(2)}`, 20, yPosition + 3);
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

  return doc.output('blob');
};

export const QuoteGenerator = ({ 
  selectedServices, 
  totalCost, 
  finalPrice,
  executionTime,
  calculatedDiscount,
  currentPaymentMethod,
  selectedInstallments,
}: QuoteGeneratorProps) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [clientName, setClientName] = useState("");
  const [quoteDate, setQuoteDate] = useState(getTodayDateString());
  const [vehicle, setVehicle] = useState("");
  const [observations, setObservations] = useState("");
  
  const [showPhoneNumberField, setShowPhoneNumberField] = useState(false);
  const [rawPhoneNumber, setRawPhoneNumber] = useState('');
  const [showAddressField, setShowAddressField] = useState(false);
  const [address, setAddress] = useState('');

  const { data: profile, isLoading: isLoadingProfile, error: profileError } = useQuery<Profile>({
    queryKey: ['userProfileForQuote', user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Usuário não autenticado.");
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const saveQuoteMutation = useMutation({
    mutationFn: async (quoteData: {
      client_name: string;
      vehicle: string;
      total_price: number;
      quote_date: string;
      services_summary: any[];
      pdf_url?: string; // Adicionar campo para URL do PDF
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
          pdf_url: quoteData.pdf_url, // Salvar a URL do PDF
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotesCalendar', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['quotesCount', user?.id] });
    },
    onError: (err) => {
      toast({
        title: "Erro ao salvar orçamento",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const uploadPdfMutation = useMutation({
    mutationFn: async ({ pdfBlob, fileName }: { pdfBlob: Blob; fileName: string }) => {
      if (!user) throw new Error("Usuário não autenticado.");

      const filePath = `${user.id}/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from('quotes')
        .upload(filePath, pdfBlob, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'application/pdf',
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('quotes')
        .getPublicUrl(filePath);
      return publicUrlData.publicUrl;
    },
    onError: (err) => {
      toast({
        title: "Erro ao fazer upload do PDF",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setRawPhoneNumber(value);
  };

  const validateInputs = () => {
    if (!clientName || !vehicle) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha o nome do cliente e o veículo.",
        variant: "destructive",
      });
      return false;
    }
    if (profileError) {
      toast({
        title: "Erro ao carregar perfil",
        description: "Não foi possível carregar os dados do seu perfil para o PDF.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const getServicesSummaryForDb = () => selectedServices.map(service => ({
    name: service.name,
    price: service.quote_price ?? service.price,
    execution_time_minutes: service.quote_execution_time_minutes ?? service.execution_time_minutes,
  }));

  const handleGenerateAndDownloadPDF = async () => {
    if (!validateInputs()) return;

    try {
      const pdfBlob = await createQuotePdfBlob(
        clientName, vehicle, quoteDate, selectedServices, finalPrice, calculatedDiscount,
        currentPaymentMethod, selectedInstallments, observations, profile,
        showPhoneNumberField, rawPhoneNumber, showAddressField, address
      );

      const fileName = `orcamento_${clientName.replace(/\s+/g, '_')}_${quoteDate}.pdf`;
      
      // Salvar orçamento no banco de dados (sem URL do PDF por enquanto)
      await saveQuoteMutation.mutateAsync({
        client_name: clientName,
        vehicle: vehicle,
        total_price: finalPrice,
        quote_date: quoteDate,
        services_summary: getServicesSummaryForDb(),
      });

      // Download do PDF
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "PDF gerado e salvo!",
        description: "O orçamento foi baixado para seu dispositivo e salvo no sistema.",
      });
    } catch (error: any) {
      console.error("Erro ao gerar ou salvar PDF:", error);
      toast({
        title: "Erro ao gerar PDF",
        description: error.message || "Não foi possível gerar o PDF do orçamento.",
        variant: "destructive",
      });
    }
  };

  const handleSendViaWhatsApp = async () => {
    if (!validateInputs()) return;
    if (!rawPhoneNumber.trim()) {
      toast({
        title: "Número de telefone ausente",
        description: "Por favor, insira o telefone do cliente para enviar via WhatsApp.",
        variant: "destructive",
      });
      return;
    }

    try {
      const pdfBlob = await createQuotePdfBlob(
        clientName, vehicle, quoteDate, selectedServices, finalPrice, calculatedDiscount,
        currentPaymentMethod, selectedInstallments, observations, profile,
        showPhoneNumberField, rawPhoneNumber, showAddressField, address
      );

      const fileName = `orcamento_${clientName.replace(/\s+/g, '_')}_${quoteDate}.pdf`;
      const pdfUrl = await uploadPdfMutation.mutateAsync({ pdfBlob, fileName });

      // Salvar orçamento no banco de dados com a URL do PDF
      await saveQuoteMutation.mutateAsync({
        client_name: clientName,
        vehicle: vehicle,
        total_price: finalPrice,
        quote_date: quoteDate,
        services_summary: getServicesSummaryForDb(),
        pdf_url: pdfUrl,
      });

      const companyName = profile?.company_name || 'Precifix'; // Alterado aqui
      const whatsappMessage = encodeURIComponent(
        `Olá! 😄\nAqui está o seu orçamento personalizado para os cuidados do seu veículo 🚗✨\n\n${pdfUrl}\n\nSe quiser fazer algum ajuste ou agendar o serviço, é só me chamar aqui no WhatsApp!\n\n${companyName}`
      );
      const whatsappLink = `https://wa.me/55${rawPhoneNumber.replace(/\D/g, '')}?text=${whatsappMessage}`;
      
      window.open(whatsappLink, '_blank');

      toast({
        title: "Orçamento enviado via WhatsApp!",
        description: "O link do PDF foi enviado para o cliente.",
      });
    } catch (error: any) {
      console.error("Erro ao enviar via WhatsApp:", error);
      toast({
        title: "Erro ao enviar via WhatsApp",
        description: error.message || "Não foi possível enviar o orçamento via WhatsApp.",
        variant: "destructive",
      });
    }
  };

  const isGeneratingOrSaving = saveQuoteMutation.isPending || isLoadingProfile;
  const isSendingWhatsApp = uploadPdfMutation.isPending || isGeneratingOrSaving;
  const isWhatsAppButtonEnabled = rawPhoneNumber.trim().length > 0 && !isSendingWhatsApp;

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
            <div className="flex gap-2">
              <Input
                id="vehicle"
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                placeholder="Ex: Honda Civic 2020"
                className="flex-1 bg-background/50"
              />
              <Button 
                type="button" 
                variant="outline" 
                size="icon"
                onClick={() => setShowPhoneNumberField(!showPhoneNumberField)}
                className={`flex items-center justify-center ${showPhoneNumberField ? 'bg-primary/20 border-primary' : 'bg-background border-border'} hover:bg-primary/10`}
                title="Adicionar Telefone"
              >
                <Phone className="h-4 w-4 text-primary" />
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                size="icon"
                onClick={() => setShowAddressField(!showAddressField)}
                className={`flex items-center justify-center ${showAddressField ? 'bg-primary/20 border-primary' : 'bg-background border-border'} hover:bg-primary/10`}
                title="Adicionar Endereço"
              >
                <MapPin className="h-4 w-4 text-primary" />
              </Button>
            </div>
          </div>

          {showPhoneNumberField && (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="phoneNumber">Telefone (Opcional)</Label>
              <Input 
                id="phoneNumber" 
                value={formatPhoneNumber(rawPhoneNumber)}
                onChange={handlePhoneNumberChange} 
                placeholder="(XX) XXXXX-XXXX"
                maxLength={15}
                className="bg-background/50 placeholder:text-gray-300" 
              />
            </div>
          )}

          {showAddressField && (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Endereço (Opcional)</Label>
              <Textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex: Rua Exemplo, 123, Bairro, Cidade - UF"
                className="bg-background/50 min-h-[80px]"
              />
            </div>
          )}

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
              <span className="text-2xl font-bold text-primary">R$ {finalPrice.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              onClick={handleGenerateAndDownloadPDF}
              className="flex-1 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
              disabled={isGeneratingOrSaving}
            >
              {isGeneratingOrSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isGeneratingOrSaving ? "Gerar PDF e Salvar Orçamento" : "Gerar PDF e Salvar Orçamento"}
            </Button>
            <Button 
              onClick={handleSendViaWhatsApp}
              className={`flex-1 ${isWhatsAppButtonEnabled ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-muted text-muted-foreground cursor-not-allowed'} transition-colors`}
              disabled={!isWhatsAppButtonEnabled}
            >
              {isSendingWhatsApp ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {isSendingWhatsApp ? "Enviando..." : "Enviar via WhatsApp"}
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center italic">
          Seu orçamento está pronto para impressionar o cliente! 🚗✨
        </p>
      </CardContent>
    </Card>
  );
};