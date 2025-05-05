import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImageUpload } from '@/components/ui/image-upload';

interface MultiImageUploadProps {
  images: string[];
  onChange: (images: string[]) => void;
}

export function MultiImageUpload({ images, onChange }: MultiImageUploadProps) {
  const handleAddImage = (url: string) => {
    onChange([...images, url]);
  };

  const handleRemoveImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onChange(newImages);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((image, index) => (
          <div key={index} className="relative group">
            <img
              src={image}
              alt={`Product image ${index + 1}`}
              className="w-full h-40 object-cover rounded-md"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => handleRemoveImage(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <ImageUpload
        value=""
        onChange={handleAddImage}
      />
    </div>
  );
} 