import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Trash2, Link as LinkIcon, Loader2, FolderOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface StorageFile {
  name: string;
  id: string; // Supabase storage items don't have a direct 'id' in list results, but we can use name as a unique key for display
  publicUrl: string;
}

const StorageTestPage = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);

  const userFolder = user ? `${user.id}` : ''; // Folder structure: quotes/user_id/file_name

  // Query to fetch files from the user's folder in the 'quotes' bucket
  const { data: files, isLoading: isLoadingFiles, error: filesError } = useQuery<StorageFile[]>({
    queryKey: ['userQuotesFiles', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.storage.from('quotes').list(userFolder, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
      });

      if (error) throw error;

      return data.map(f => ({
        name: f.name,
        id: f.id, // Supabase list returns 'id' for files, which is actually the file name
        publicUrl: supabase.storage.from('quotes').getPublicUrl(`${userFolder}/${f.name}`).data.publicUrl,
      }));
    },
    enabled: !!user,
  });

  // Mutation for uploading a file
  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Usuário não autenticado.");
      setUploadingFileName(file.name);
      const filePath = `${userFolder}/${file.name}`;
      const { data, error } = await supabase.storage.from('quotes').upload(filePath, file, {
        cacheControl: '3600',
        upsert: true, // Allow overwriting existing files (tests UPDATE policy implicitly)
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userQuotesFiles', user?.id] });
      toast({
        title: "Upload realizado!",
        description: "O arquivo foi enviado com sucesso.",
      });
      setFileToUpload(null);
      setUploadingFileName(null);
    },
    onError: (err) => {
      console.error("Erro ao fazer upload:", err);
      toast({
        title: "Erro no Upload",
        description: err.message,
        variant: "destructive",
      });
      setUploadingFileName(null);
    },
  });

  // Mutation for deleting a file
  const deleteFileMutation = useMutation({
    mutationFn: async (fileName: string) => {
      if (!user) throw new Error("Usuário não autenticado.");
      const filePath = `${userFolder}/${fileName}`;
      const { data, error } = await supabase.storage.from('quotes').remove([filePath]);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userQuotesFiles', user?.id] });
      toast({
        title: "Arquivo removido!",
        description: "O arquivo foi excluído com sucesso.",
      });
    },
    onError: (err) => {
      console.error("Erro ao deletar:", err);
      toast({
        title: "Erro ao Deletar",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFileToUpload(e.target.files[0]);
    } else {
      setFileToUpload(null);
    }
  };

  const handleUpload = () => {
    if (fileToUpload) {
      uploadFileMutation.mutate(fileToUpload);
    } else {
      toast({
        title: "Nenhum arquivo selecionado",
        description: "Por favor, selecione um arquivo para fazer upload.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = (fileName: string) => {
    deleteFileMutation.mutate(fileName);
  };

  const handleOpenPublicUrl = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 shadow-[var(--shadow-elegant)]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <FolderOpen className="h-5 w-5 text-primary" />
            <CardTitle className="text-foreground">Teste de Supabase Storage (Bucket 'quotes')</CardTitle>
          </div>
          <CardDescription>
            Use esta página para testar as políticas de RLS que você configurou para o bucket 'quotes'.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Upload de Arquivo</h3>
            <div className="flex items-center space-x-2">
              <Input type="file" onChange={handleFileChange} className="flex-1 bg-background" />
              <Button 
                onClick={handleUpload} 
                disabled={!fileToUpload || uploadFileMutation.isPending}
                className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
              >
                {uploadFileMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando {uploadingFileName}...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </>
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Tente fazer upload de um arquivo. Se as políticas de `INSERT` e `UPDATE` estiverem corretas, o upload deve ser bem-sucedido e o arquivo aparecerá abaixo.
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t border-border/50">
            <h3 className="text-lg font-semibold text-foreground">Seus Arquivos no Bucket 'quotes'</h3>
            {isLoadingFiles ? (
              <div className="flex justify-center items-center h-24">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Carregando arquivos...</p>
              </div>
            ) : filesError ? (
              <p className="text-destructive">Erro ao carregar arquivos: {filesError.message}</p>
            ) : files && files.length > 0 ? (
              <ul className="space-y-3">
                {files.map((file) => (
                  <li key={file.id} className="flex items-center justify-between p-3 rounded-lg bg-background border border-border/50">
                    <span className="font-medium text-foreground flex-1 truncate mr-4">{file.name}</span>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleOpenPublicUrl(file.publicUrl)}
                        className="text-primary hover:bg-primary/10"
                        title="Abrir URL Pública (teste de SELECT)"
                      >
                        <LinkIcon className="h-4 w-4 mr-2" />
                        Ver
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => handleDelete(file.name)}
                        disabled={deleteFileMutation.isPending}
                        title="Deletar Arquivo (teste de DELETE)"
                      >
                        {deleteFileMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground italic">Nenhum arquivo encontrado na sua pasta.</p>
            )}
            <p className="text-sm text-muted-foreground">
              Para testar a política de `SELECT` (leitura pública), clique em "Ver" e tente abrir o link em uma janela anônima do navegador. Ele deve ser acessível sem login.
            </p>
            <p className="text-sm text-muted-foreground">
              Para testar a política de `DELETE`, clique no botão de lixeira. O arquivo deve ser removido.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StorageTestPage;