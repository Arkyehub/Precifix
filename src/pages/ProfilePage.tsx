import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User as UserIcon, Camera } from 'lucide-react';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  document_number: string | null;
  address: string | null;
  address_number: string | null; // Novo campo
  zip_code: string | null;      // Novo campo
  phone_number: string | null;
  avatar_url: string | null;
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

// Helper function to format Phone Number
const formatPhoneNumber = (value: string) => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 10) { // Standard phone number (e.g., 8 digits)
    return cleaned
      .replace(/^(\d{2})(\d)/g, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  } else { // Mobile phone number (e.g., 9 digits)
    return cleaned
      .replace(/^(\d{2})(\d)/g, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2');
  }
};

const ProfilePage = () => {
  const { user, session } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [rawDocumentNumber, setRawDocumentNumber] = useState(''); // Armazena o valor sem formatação
  const [zipCode, setZipCode] = useState('');
  const [address, setAddress] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [rawPhoneNumber, setRawPhoneNumber] = useState(''); // Armazena o valor sem formatação
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);

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
      setRawDocumentNumber(profile.document_number || ''); // Preencher com valor raw
      setZipCode(profile.zip_code || '');
      setAddress(profile.address || '');
      setAddressNumber(profile.address_number || '');
      setRawPhoneNumber(profile.phone_number || ''); // Preencher com valor raw
      setCurrentAvatarUrl(profile.avatar_url);
    }
  }, [profile]);

  const fetchAddressByZipCode = async (cep: string) => {
    const cleanedCep = cep.replace(/\D/g, ''); // Usar CEP limpo para a API
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
        setAddress(''); // Limpa o endereço se o CEP for inválido
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
    const value = e.target.value.replace(/\D/g, ''); // Remove caracteres não numéricos
    setZipCode(value);
    if (value.length === 8) {
      fetchAddressByZipCode(value);
    }
  };

  const handleDocumentNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Remove caracteres não numéricos
    setRawDocumentNumber(value);
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Remove caracteres não numéricos
    setRawPhoneNumber(value);
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (updatedProfile: Partial<Profile>) => {
      if (!user) throw new Error("User not authenticated.");

      // Handle avatar upload first
      let newAvatarUrl = currentAvatarUrl;
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${user.id}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`; // Store in a user-specific folder

        // Upload file to Supabase storage
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, {
            cacheControl: '3600',
            upsert: true, // Overwrite if file exists
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
        newAvatarUrl = publicUrlData.publicUrl;
      }

      // Update profile in public.profiles table
      const { error: profileError } = await supabase
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
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Optionally, update auth.users user_metadata for immediate reflection in session
      // This is important for the Header component to update without a full page refresh
      if (newAvatarUrl !== user.user_metadata?.avatar_url || updatedProfile.first_name !== user.user_metadata?.first_name || updatedProfile.last_name !== user.user_metadata?.last_name) {
        const { data: authUpdateData, error: authUpdateError } = await supabase.auth.updateUser({
          data: {
            first_name: updatedProfile.first_name,
            last_name: updatedProfile.last_name,
            avatar_url: newAvatarUrl,
          },
        });
        if (authUpdateError) console.error("Error updating auth user metadata:", authUpdateError);
      }

      return { ...profile, ...updatedProfile, avatar_url: newAvatarUrl };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['userProfile', user?.id] });
      toast({
        title: "Perfil atualizado!",
        description: "Suas informações foram salvas com sucesso.",
      });
      setCurrentAvatarUrl(data.avatar_url); // Update local state for avatar
      setAvatarFile(null); // Clear selected file
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
      document_number: rawDocumentNumber, // Enviar valor raw
      zip_code: zipCode,
      address: address,
      address_number: addressNumber,
      phone_number: rawPhoneNumber, // Enviar valor raw
    });
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAvatarFile(e.target.files[0]);
      // Create a temporary URL for preview
      setCurrentAvatarUrl(URL.createObjectURL(e.target.files[0]));
    }
  };

  const getUserInitials = (user: any) => {
    if (!user) return '??';
    const firstInitial = (firstName || user.user_metadata?.first_name || '').charAt(0);
    const lastInitial = (lastName || user.user_metadata?.last_name || '').charAt(0);
    return `${firstInitial}${lastInitial}`.toUpperCase() || user.email?.substring(0, 2).toUpperCase() || '??';
  };

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
                  <AvatarImage src={currentAvatarUrl || ""} alt={firstName || "User"} />
                  <AvatarFallback className="w-32 h-32 text-5xl bg-primary text-primary-foreground">
                    {getUserInitials(user)}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute bottom-0 right-0 bg-primary p-2 rounded-full border-2 border-background">
                  <Camera className="h-5 w-5 text-primary-foreground" />
                </div>
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
                  value={formatCpfCnpj(rawDocumentNumber)} // Exibe formatado
                  onChange={handleDocumentNumberChange} 
                  placeholder="Ex: 111.222.333-01 ou 43.996.853/0001-38"
                  maxLength={18} // Max length for CNPJ formatted
                  className="bg-background" 
                />
              </div>
              
              {/* Campos de CEP e Endereço/Número */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="zip-code">CEP:</Label>
                <Input 
                  id="zip-code" 
                  value={formatCep(zipCode)} // Exibe formatado
                  onChange={handleZipCodeChange} 
                  onBlur={() => zipCode.length === 8 && fetchAddressByZipCode(zipCode)} // Busca ao perder o foco
                  placeholder="Ex: 00000-000"
                  maxLength={9} // Max length for CEP formatted
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
                  value={formatPhoneNumber(rawPhoneNumber)} // Exibe formatado
                  onChange={handlePhoneNumberChange} 
                  placeholder="Ex: (XX) XXXXX-XXXX"
                  maxLength={15} // Max length for phone formatted
                  className="bg-background" 
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={updateProfileMutation.isPending}>
              {updateProfileMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;