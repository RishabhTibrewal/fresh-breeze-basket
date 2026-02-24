import { useState, useId } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  onFileSelect?: (file: File) => void | Promise<void>;
  disabled?: boolean;
  size?: 'default' | 'small' | 'large';
}

export function ImageUpload({ value, onChange, onFileSelect, disabled, size = 'default' }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const inputId = useId();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      
      // If custom upload handler is provided, use it
      if (onFileSelect) {
        await onFileSelect(file);
      } else {
        // Default: create blob URL (temporary, for preview only)
        await new Promise(resolve => setTimeout(resolve, 1000));
        const imageUrl = URL.createObjectURL(file);
        onChange(imageUrl);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const sizeClasses = {
    small: 'max-w-xs',
    default: 'max-w-md',
    large: 'max-w-2xl',
  };

  const aspectClasses = {
    small: 'aspect-square',
    default: 'aspect-video',
    large: 'aspect-video',
  };

  const paddingClasses = {
    small: 'p-4',
    default: 'p-8',
    large: 'p-12',
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${sizeClasses[size]}`}>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        id={inputId}
        onChange={handleFileChange}
        disabled={disabled}
      />
      {value ? (
        <div className={`relative w-full ${aspectClasses[size]}`}>
          <img
            src={value}
            alt="Uploaded"
            className="w-full h-full object-cover rounded-md"
          />
          <label
            htmlFor={inputId}
            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity cursor-pointer rounded-md"
          >
            <Button variant="secondary" disabled={isUploading || disabled} size="sm">
              Change Image
            </Button>
          </label>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={`w-full border-2 border-dashed rounded-md ${paddingClasses[size]} flex flex-col items-center gap-4 transition-colors ${
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-primary'
          }`}
        >
          <Upload className={`${size === 'small' ? 'h-6 w-6' : 'h-8 w-8'} text-muted-foreground`} />
          <div className="text-sm text-muted-foreground text-center">
            <p className="font-medium">Click to upload</p>
            <p>or drag and drop</p>
          </div>
        </label>
      )}
    </div>
  );
} 