import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
}

export function ImageUpload({ value, onChange }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      // Here you would typically upload the file to your storage service
      // For now, we'll use a fake delay and URL
      await new Promise(resolve => setTimeout(resolve, 1000));
      const imageUrl = URL.createObjectURL(file);
      onChange(imageUrl);
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <input
        type="file"
        accept="image/*"
        className="hidden"
        id="imageUpload"
        onChange={handleFileChange}
      />
      {value ? (
        <div className="relative w-full aspect-video">
          <img
            src={value}
            alt="Uploaded"
            className="w-full h-full object-cover rounded-md"
          />
          <label
            htmlFor="imageUpload"
            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity cursor-pointer rounded-md"
          >
            <Button variant="secondary" disabled={isUploading}>
              Change Image
            </Button>
          </label>
        </div>
      ) : (
        <label
          htmlFor="imageUpload"
          className="w-full border-2 border-dashed rounded-md p-8 flex flex-col items-center gap-4 cursor-pointer hover:border-primary transition-colors"
        >
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div className="text-sm text-muted-foreground text-center">
            <p className="font-medium">Click to upload</p>
            <p>or drag and drop</p>
          </div>
        </label>
      )}
    </div>
  );
} 