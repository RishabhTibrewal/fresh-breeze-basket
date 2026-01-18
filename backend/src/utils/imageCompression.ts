import sharp from 'sharp';

export interface CompressionOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  format?: 'jpeg' | 'jpg' | 'png' | 'webp';
}

/**
 * Compress image buffer using Sharp
 * @param buffer - Image buffer to compress
 * @param options - Compression options
 * @returns Compressed image buffer
 */
export const compressImage = async (
  buffer: Buffer,
  options: CompressionOptions = {}
): Promise<Buffer> => {
  const {
    quality = 80,
    maxWidth = 1920,
    maxHeight = 1920,
    format = 'jpeg'
  } = options;

  // Normalize 'jpg' to 'jpeg' for consistency
  const normalizedFormat = format === 'jpg' ? 'jpeg' : format;

  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    // Determine if resizing is needed
    const needsResize = metadata.width && metadata.width > maxWidth ||
                       metadata.height && metadata.height > maxHeight;

    let pipeline = image;

    // Resize if needed, maintaining aspect ratio
    if (needsResize) {
      pipeline = pipeline.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Convert and compress based on format
    switch (normalizedFormat) {
      case 'jpeg':
        return await pipeline
          .jpeg({ quality, mozjpeg: true })
          .toBuffer();
      
      case 'png':
        return await pipeline
          .png({ quality, compressionLevel: 9 })
          .toBuffer();
      
      case 'webp':
        return await pipeline
          .webp({ quality })
          .toBuffer();
      
      default:
        return await pipeline
          .jpeg({ quality, mozjpeg: true })
          .toBuffer();
    }
  } catch (error) {
    console.error('Image compression error:', error);
    throw new Error(`Failed to compress image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Compress image for categories (moderate compression, 1920px max width)
 */
export const compressCategoryImage = async (buffer: Buffer): Promise<Buffer> => {
  return compressImage(buffer, {
    quality: 80,
    maxWidth: 1920,
    maxHeight: 1920,
    format: 'jpeg'
  });
};

/**
 * Compress image for products (moderate compression, 1920px max width)
 */
export const compressProductImage = async (buffer: Buffer): Promise<Buffer> => {
  return compressImage(buffer, {
    quality: 80,
    maxWidth: 1920,
    maxHeight: 1920,
    format: 'jpeg'
  });
};

/**
 * Compress image for bills/invoices (moderate compression, 1200px max width)
 */
export const compressBillImage = async (buffer: Buffer): Promise<Buffer> => {
  return compressImage(buffer, {
    quality: 80,
    maxWidth: 1200,
    maxHeight: 1200,
    format: 'jpeg'
  });
};

/**
 * Check if file is an image that can be compressed
 */
export const isImageFile = (mimetype: string): boolean => {
  return ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(mimetype);
};

/**
 * Check if file is a PDF (should not be compressed)
 */
export const isPdfFile = (mimetype: string): boolean => {
  return mimetype === 'application/pdf';
};
