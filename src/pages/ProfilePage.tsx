import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User as UserIcon, Camera, Loader2 } from 'lucide-react';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ImageCropperDialog } from '@/components/ImageCropperDialog'; // Importar o novo componente
import { formatPhoneNumber } from '@/lib/utils'; // Importar formatPhoneNumber do utilitário

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
  updated_at: string; // Adicionado updated_at para cache-busting
}

// Helper function to format CEP
const formatCep = (value: string) => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 5) {
    return cleaned;
  }
  return `${cleaned.substring(0, 5)}-${cleaned.substring(5, 8)}`;
};

// Helper function to format CPF or CNPJ
const formatCpfCnpj = (value: string) => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 11) { // CPF
    return cleaned
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  } else { // CNPJ
    return cleaned
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
};

// Nova função utilitária para redimensionar e comprimir a imagem (movida de dentro do componente)
const resizeAndCompressImage = (file: File): Promise<File | null> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIMENSION = 1000; // Max width/height
        const MAX_FILE_SIZE_BYTES = 500 * 1024; // 500 KB

        let width = img.width;
        let height = img.height;

        // Check dimensions
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = (height * MAX_DIMENSION) / width;
            width = MAX_DIMENSION;
          } else {
            width = (width * MAX_DIMENSION) / height;
            height = MAX_DIMENSION;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        let quality = 0.9; // Start with high quality
        const attemptCompression = () => {
          canvas.toBlob((blob) => {
            if (!blob) {
              console.error("Failed to create blob during compression.");
              resolve(null);
              return;
            }

            if (blob.size > MAX_FILE_SIZE_BYTES && quality > 0.1) {
              quality -= 0.1; // Reduce quality
              attemptCompression(); // Try again with lower quality
            } else if (blob.size > MAX_FILE_SIZE_BYTES && quality <= 0.1) {
              console.warn("Image still too large after max compression (max 500KB).");
              resolve(null);
            } else {
              resolve(new File([blob], file.name, { type: 'image/jpeg' }));
            }
          }, 'image/jpeg', quality);
        };

        attemptCompression();
      };
      img.onerror = () => {
        console.error("Error loading image for resizing/compression.");
        resolve(null);
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      console.error("Error reading file for resizing/compression.");
      resolve(null);
    };
    reader.readAsDataURL(file);
  });
};


const ProfilePage = () => {
  const { user, session } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [rawDocumentNumber, setRawDocumentNumber] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [address, setAddress] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [rawPhoneNumber, setRawPhoneNumber] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [tempAvatarUrl, setTempAvatarUrl] = useState<string | null>(null); // Nova variável para a URL temporária da prévia
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  // Estados para o cropper
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [imageSrcForCropper, setImageSrcForCropper] = useState<string | null>(null);

  // Fetch user profile data
  const { data: profile, isLoading, error } = useQuery<Profile>({
    queryKey: ['userProfile', user?.id],
    queryFn: async () => {
      if (!user) throw new Error("User not authenticated.");
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

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setCompanyName(profile.company_name || '');
      setRawDocumentNumber(profile.document_number || '');
      setZipCode(profile.zip_code || '');
      setAddress(profile.address || '');
      setAddressNumber(profile.address_number || '');
      setRawPhoneNumber(profile.phone_number || '');
      // Não definimos tempAvatarUrl aqui, ele é apenas para a prévia de um novo arquivo
    }
  }, [profile]);

  const fetchAddressByZipCode = async (cep: string) => {
    const cleanedCep = cep.replace(/\D/g, '');
    if (cleanedCep.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`);
      const data = await response.json();

      if (data.erro) {
        toast({
          title: "CEP não encontrado",
          description: "Verifique o CEP e tente novamente.",
          variant: "destructive",
        });
        setAddress('');
        return;
      }

      const fullAddress = `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`;
      setAddress(fullAddress);
      toast({
        title: "Endereço preenchido!",
        description: "O endereço foi preenchido automaticamente com base no CEP.",
      });
    } catch (err: any) {
      console.error("Error fetching address by CEP:", err);
      toast({
        title: "Erro ao buscar CEP",
        description: "Não foi possível buscar o endereço. Tente novamente mais tarde.",
        variant: "destructive",
      });
    }
  };

  const handleZipCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setZipCode(value);
  };

  const handleDocumentNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setRawDocumentNumber(value);
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setRawPhoneNumber(value);
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (updatedProfile: Partial<Profile>) => {
      if (!user) throw new Error("User not authenticated.");

      let newAvatarUrl = profile?.avatar_url;
      let currentProfileUpdatedAt = profile?.updated_at; // Get current updated_at

      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${user.id}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, {
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
        newAvatarUrl = publicUrlData.publicUrl;
      }

      // Update profiles table
      const { data: updatedProfileData, error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: updatedProfile.first_name,
          last_name: updatedProfile.last_name,
          company_name: updatedProfile.company_name,
          document_number: updatedProfile.document_number,
          zip_code: updatedProfile.zip_code,
          address: updatedProfile.address,
          address_number: updatedProfile.address_number,
          phone_number: updatedProfile.phone_number,
          avatar_url: newAvatarUrl,
          // updated_at is automatically handled by the trigger 'update_updated_at_column'
          // but we need its *new* value for auth.updateUser
        })
        .eq('id', user.id)
        .select('updated_at') // Select updated_at to get the new timestamp
        .single();

      if (profileError) throw profileError;
      if (updatedProfileData) {
        currentProfileUpdatedAt = updatedProfileData.updated_at; // Use the newly updated timestamp
      }

      // Update user metadata in Supabase Auth
      // Only update if avatar_url or name fields have changed
      const shouldUpdateAuthMetadata = 
        newAvatarUrl !== user.user_metadata?.avatar_url || 
        updatedProfile.first_name !== user.user_metadata?.first_name || 
        updatedProfile.last_name !== user.user_metadata?.last_name ||
        (newAvatarUrl && currentProfileUpdatedAt); // Also update if avatar was just set/updated

      if (shouldUpdateAuthMetadata) {
        const { data: authUpdateData, error: authUpdateError } = await supabase.auth.updateUser({
          data: {
            first_name: updatedProfile.first_name,
            last_name: updatedProfile.last_name,
            avatar_url: newAvatarUrl,
            avatar_updated_at: currentProfileUpdatedAt, // Store the timestamp for cache-busting in header
          },
        });
        if (authUpdateError) console.error("Error updating auth user metadata:", authUpdateError);
      }

      return { ...profile, ...updatedProfile, avatar_url: newAvatarUrl, updated_at: currentProfileUpdatedAt };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['userProfile', user?.id] });
      // Força a atualização da sessão para que o user_metadata seja atualizado em todos os lugares (ex: Header)
      supabase.auth.refreshSession(); 
      toast({
        title: "Perfil atualizado!",
        description: "Suas informações foram salvas com sucesso.",
      });
      setAvatarFile(null);
      setTempAvatarUrl(null);
    },
    onError: (err) => {
      toast({
        title: "Erro ao atualizar perfil",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate({
      first_name: firstName,
      last_name: lastName,
      company_name: companyName,
      document_number: rawDocumentNumber,
      zip_code: zipCode,
      address: address,
      address_number: addressNumber,
      phone_number: rawPhoneNumber,
    });
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrcForCropper(reader.result as string);
        setIsCropperOpen(true);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setIsProcessingImage(true);
    setAvatarFile(null); // Limpa o arquivo anterior
    setTempAvatarUrl(null); // Limpa a URL temporária anterior

    try {
      const croppedFile = new File([croppedBlob], "avatar.jpeg", { type: "image/jpeg" });
      const processedFile = await resizeAndCompressImage(croppedFile);
      
      if (processedFile) {
        setAvatarFile(processedFile);
        setTempAvatarUrl(URL.createObjectURL(processedFile)); // Define a URL temporária para prévia
      } else {
        toast({
          title: "Erro ao processar imagem",
          description: "Não foi possível otimizar a imagem após o corte. Tente uma imagem menor.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro durante o processamento da imagem após corte:", error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro ao processar a imagem.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Limpa o input para permitir re-seleção
      }
    }
  };

  const getUserInitials = (user: any) => {
    if (!user) return '??';
    const firstInitial = (firstName || user.user_metadata?.first_name || '').charAt(0);
    const lastInitial = (lastName || user.user_metadata?.last_name || '').charAt(0);
    return `${firstInitial}${lastInitial}`.toUpperCase() || user.email?.substring(0, 2).toUpperCase() || '??';
  };

  const isUploadingOrProcessing = isProcessingImage || updateProfileMutation.isPending;

  // Determina qual URL de avatar usar para exibição
  // Adiciona o timestamp para cache-busting se profile.updated_at estiver disponível
  const avatarToDisplay = tempAvatarUrl || (profile?.avatar_url && profile?.updated_at 
    ? `${profile.avatar_url}?t=${new Date(profile.updated_at).getTime()}` 
    : profile?.avatar_url);

  if (isLoading) return <p>Carregando perfil...</p>;
  if (error) return <p>Erro ao carregar perfil: {error.message}</p>;
  if (!user) return <p>Por favor, faça login para ver seu perfil.</p>;

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
                Gerencie suas informações de perfil e foto.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-32 h-32 cursor-pointer" onClick={handleAvatarClick}>
                <Avatar className="w-32 h-32">
                  {isUploadingOrProcessing ? (
                    <AvatarFallback className="w-32 h-32 text-5xl bg-primary text-primary-foreground flex items-center justify-center">
                      <Loader2 className="h-10 w-10 animate-spin" />
                    </AvatarFallback>
                  ) : (
                    <>
                      {avatarToDisplay ? (
                        <AvatarImage src={avatarToDisplay} alt={firstName || "User"} />
                      ) : (
                        <AvatarFallback className="w-32 h-32 text-5xl bg-primary text-primary-foreground">
                          {getUserInitials(user)}
                        </AvatarFallback>
                      )}
                    </>
                  )}
                </Avatar>
                {!isUploadingOrProcessing && (
                  <div className="absolute bottom-0 right-0 bg-primary p-2 rounded-full border-2 border-background">
                    <Camera className="h-5 w-5 text-primary-foreground" />
                  </div>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first-name">Nome:</Label>
                <Input id="first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-name">Sobrenome:</Label>
                <Input id="last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-name">Empresa:</Label>
                <Input id="company-name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="document-number">CPF (titular) ou CNPJ:</Label>
                <Input 
                  id="document-number" 
                  value={formatCpfCnpj(rawDocumentNumber)}
                  onChange={handleDocumentNumberChange} 
                  maxLength={18}
                  className="bg-background" 
                />
              </div>
              
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="zip-code">CEP:</Label>
                <Input 
                  id="zip-code" 
                  value={formatCep(zipCode)}
                  onChange={handleZipCodeChange} 
                  onBlur={() => zipCode.length === 8 && fetchAddressByZipCode(zipCode)}
                  maxLength={9}
                  className="bg-background" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Endereço:</Label>
                <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address-number">Número:</Label>
                <Input id="address-number" value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} className="bg-background" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone-number">Telefone:</Label>
                <Input 
                  id="phone-number" 
                  value={formatPhoneNumber(rawPhoneNumber)}
                  onChange={handlePhoneNumberChange} 
                  placeholder="(XX) XXXXX-XXXX"
                  maxLength={15}
                  className="bg-background placeholder:text-gray-300" 
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={updateProfileMutation.isPending}>
              {updateProfileMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <ImageCropperDialog
        isOpen={isCropperOpen}
        imageSrc={imageSrcForCropper}
        onClose={() => {
          setIsCropperOpen(false);
          setImageSrcForCropper(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = ''; // Limpa o input de arquivo
          }
        }}
        onCropComplete={handleCropComplete}
        aspectRatio={1} // Para avatar circular
        cropShape="round"
      />
    </div>
  );
};

export default ProfilePage;