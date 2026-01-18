import { S3Client } from '@aws-sdk/client-s3';

/**
 * Initialize and export Cloudflare R2 client
 * This client is used for uploading files to Cloudflare R2 storage
 */
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

/**
 * Get the public URL for a file stored in R2
 * @param fileName - The file path/key in R2
 * @returns The public URL for the file
 */
/**
 * Get the public URL for a file stored in R2
 * @param fileName - The file path/key in R2
 * @returns The public URL for the file
 * Format: https://pub-{hash}.r2.dev/{fileName}
 */
export const getR2PublicUrl = (fileName: string): string => {
  const publicDomain = (process.env.R2_PUBLIC_DOMAIN || '').trim();
  const bucketName = process.env.R2_BUCKET_NAME || '';
  const accountId = process.env.R2_ACCOUNT_ID || '';

  if (publicDomain && publicDomain.length > 0) {
    // Remove trailing slash if present, then append fileName
    // Format: https://pub-{hash}.r2.dev/{fileName}
    const cleanDomain = publicDomain.replace(/\/$/, '');
    return `${cleanDomain}/${fileName}`;
  }

  // Fallback to R2 default URL format
  if (bucketName && accountId) {
    console.warn('⚠️ R2_PUBLIC_DOMAIN not set! Using fallback URL format.');
    return `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${fileName}`;
  }

  throw new Error('R2 configuration is missing. Please set R2_PUBLIC_DOMAIN or R2_BUCKET_NAME and R2_ACCOUNT_ID');
};
