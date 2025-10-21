import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Crop, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/utils'; // Para usar as classes do shadcn/ui

interface ImageCropperDialogProps {
  isOpen: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onCropComplete: (croppedImageBlob: Blob) => void;
  aspectRatio?: number;
  cropShape?: 'rect' | 'round';
}

export const ImageCropperDialog = ({
  isOpen,
  imageSrc,
  onClose,
  onCropComplete,
  aspectRatio = 1, // Default para quadrado (círculo)
  cropShape = 'round', // Default para forma redonda
}: ImageCropperDialogProps) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const onCropChange = useCallback((newCrop: { x: number; y: number }) => {
    setCrop(newCrop);
  }, []);

  const onZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  const onCropAreaChange = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous'); // Needed for cross-origin images
      image.src = url;
    });

  const getCroppedImage = async (imageSrc: string, croppedAreaPixels: any): Promise<Blob> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    const maxSize = Math.max(image.width, image.height);
    const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

    // set canvas size to match the bounding box of the rotated image
    canvas.width = safeArea;
    canvas.height = safeArea;

    // translate canvas context to a central point on the canvas
    ctx.translate(safeArea / 2, safeArea / 2);
    ctx.translate(-safeArea / 2, -safeArea / 2);

    // draw rotated image and store data.
    ctx.drawImage(
      image,
      safeArea / 2 - image.width * 0.5,
      safeArea / 2 - image.height * 0.5
    );

    const data = ctx.getImageData(0, 0, safeArea, safeArea);

    // set canvas width to final desired crop size - this will clear existing context
    canvas.width = croppedAreaPixels.width;
    canvas.height = croppedAreaPixels.height;

    // paste generated rotated image at the top left corner of the canvas
    ctx.putImageData(
      data,
      Math.round(0 - safeArea / 2 + image.width * 0.5 - croppedAreaPixels.x),
      Math.round(0 - safeArea / 2 + image.height * 0.5 - croppedAreaPixels.y)
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          throw new Error('Failed to create blob');
        }
      }, 'image/jpeg', 0.9); // Always output as JPEG for consistency and compression
    });
  };

  const handleCrop = async () => {
    if (imageSrc && croppedAreaPixels) {
      try {
        const croppedBlob = await getCroppedImage(imageSrc, croppedAreaPixels);
        onCropComplete(croppedBlob);
        onClose();
      } catch (e) {
        console.error('Erro ao cortar imagem:', e);
        // Adicionar um toast de erro aqui se houver um sistema de toast
      }
    }
  };

  return (
    <Dialog open={isOpen && !!imageSrc} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-card flex flex-col h-[90vh] max-h-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crop className="h-5 w-5 text-primary" />
            Ajustar Imagem de Perfil
          </DialogTitle>
        </DialogHeader>
        <div className="relative flex-1 w-full bg-muted rounded-md overflow-hidden">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspectRatio}
              onCropChange={onCropChange}
              onZoomChange={onZoomChange}
              onCropComplete={onCropAreaChange}
              cropShape={cropShape}
              showGrid={false}
              classes={{
                containerClassName: "bg-muted",
                mediaClassName: "object-contain",
              }}
            />
          )}
        </div>
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-3">
            <Label htmlFor="zoom-slider" className="text-sm flex items-center gap-1 text-muted-foreground">
              <ZoomOut className="h-4 w-4" />
              Zoom
              <ZoomIn className="h-4 w-4" />
            </Label>
            <Slider
              id="zoom-slider"
              min={1}
              max={3}
              step={0.1}
              value={[zoom]}
              onValueChange={(val) => setZoom(val[0])}
              className="flex-1"
            />
          </div>
        </div>
        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleCrop} disabled={!imageSrc || !croppedAreaPixels}>
            Cortar e Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};