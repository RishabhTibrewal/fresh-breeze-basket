import express, { Response } from 'express';
import multer from 'multer';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { protect, adminOnly } from '../middleware/auth';
import { 
  compressCategoryImage, 
  compressProductImage, 
  compressBillImage,
  isImageFile,
  isPdfFile 
} from '../utils/imageCompression';
import { supabase } from '../config/supabase';

// Extend Express Request type to include file from multer
interface MulterRequest extends express.Request {
  file?: Express.Multer.File;
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
}

const router = express.Router();

// Configure multer to store files in memory
// Increased limits to 50MB to handle high-resolution images
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit (increased from 20MB)
    fieldSize: 50 * 1024 * 1024, // 50MB for non-file fields
    files: 10, // Maximum number of files
  },
});

// Initialize R2 Client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

/**
 * Upload bill image to Cloudflare R2
 * POST /api/uploads/bill
 * Requires authentication
 */
router.post('/bill', protect, upload.single('billImage'), async (req: MulterRequest, res: Response) => {
  try {
    const file = req.file;
    const orderId = req.body.orderId;

    if (!file) {
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded' 
      });
    }

    if (!orderId) {
      return res.status(400).json({ 
        success: false,
        error: 'Order ID is required' 
      });
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid file type. Only images (JPEG, PNG, WebP) and PDFs are allowed.' 
      });
    }

    // Generate unique filename
    const fileExtension = file.originalname.split('.').pop() || 'jpg';
    const fileName = `bills/${orderId}-${Date.now()}.${fileExtension}`;

    // Upload to Cloudflare R2
    const parallelUploads3 = new Upload({
      client: r2Client,
      params: {
        Bucket: process.env.R2_BUCKET_NAME || '',
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
      },
    });

    await parallelUploads3.done();

    // Construct public URL
    // Format: https://pub-{hash}.r2.dev/{fileName}
    const publicDomain = (process.env.R2_PUBLIC_DOMAIN || '').trim();
    let imageUrl: string;
    
    if (publicDomain && publicDomain.length > 0) {
      // Remove trailing slash if present, then append fileName
      const cleanDomain = publicDomain.replace(/\/$/, '');
      imageUrl = `${cleanDomain}/${fileName}`;
    } else {
      // Fallback to R2 default URL format
      console.warn('⚠️ R2_PUBLIC_DOMAIN not set! Using fallback URL format.');
      const bucketName = process.env.R2_BUCKET_NAME || '';
      const accountId = process.env.R2_ACCOUNT_ID || '';
      imageUrl = `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${fileName}`;
    }

    res.json({ 
      success: true, 
      url: imageUrl,
      fileName: fileName,
    });

  } catch (error: any) {
    console.error('Upload Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Upload failed' 
    });
  }
});

/**
 * Upload general file to Cloudflare R2
 * POST /api/uploads/file
 * Requires authentication
 */
router.post('/file', protect, upload.single('file'), async (req: MulterRequest, res: Response) => {
  try {
    const file = req.file;
    const folder = req.body.folder || 'uploads'; // Default folder
    const customFileName = req.body.fileName;

    if (!file) {
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded' 
      });
    }

    // Generate unique filename
    const fileExtension = file.originalname.split('.').pop() || 'bin';
    const fileName = customFileName 
      ? `${folder}/${customFileName}`
      : `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;

    // Upload to Cloudflare R2
    const parallelUploads3 = new Upload({
      client: r2Client,
      params: {
        Bucket: process.env.R2_BUCKET_NAME || '',
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
      },
    });

    await parallelUploads3.done();

    // Construct public URL
    // Format: https://pub-{hash}.r2.dev/{fileName}
    const publicDomain = process.env.R2_PUBLIC_DOMAIN || '';
    let fileUrl: string;
    
    if (publicDomain) {
      // Remove trailing slash if present, then append fileName
      const cleanDomain = publicDomain.replace(/\/$/, '');
      fileUrl = `${cleanDomain}/${fileName}`;
    } else {
      // Fallback to R2 default URL format
      fileUrl = `https://${process.env.R2_BUCKET_NAME}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${fileName}`;
    }

    res.json({ 
      success: true, 
      url: fileUrl,
      fileName: fileName,
    });

  } catch (error: any) {
    console.error('Upload Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Upload failed' 
    });
  }
});

/**
 * Upload category image to Cloudflare R2
 * POST /api/uploads/category/:categoryId
 * Requires authentication and admin role
 */
router.post('/category/:categoryId', protect, adminOnly, upload.single('image'), async (req: MulterRequest, res: Response) => {
  try {
    const file = req.file;
    const { categoryId } = req.params;

    if (!file) {
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded' 
      });
    }

    if (!req.companyId) {
      return res.status(400).json({
        success: false,
        error: 'Company context is required'
      });
    }

    // Validate file type
    if (!isImageFile(file.mimetype)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid file type. Only images (JPEG, PNG, WebP) are allowed.' 
      });
    }

    // Compress image
    const compressedBuffer = await compressCategoryImage(file.buffer);

    // Generate unique filename
    const fileExtension = 'jpg'; // Always save as jpeg after compression
    const fileName = `categories/${categoryId}-${Date.now()}.${fileExtension}`;

    // Upload to Cloudflare R2
    const parallelUploads3 = new Upload({
      client: r2Client,
      params: {
        Bucket: process.env.R2_BUCKET_NAME || '',
        Key: fileName,
        Body: compressedBuffer,
        ContentType: 'image/jpeg',
      },
    });

    await parallelUploads3.done();

    // Construct public URL
    // Format: https://pub-{hash}.r2.dev/{fileName}
    const publicDomain = (process.env.R2_PUBLIC_DOMAIN || '').trim();
    let imageUrl: string;
    
    if (publicDomain && publicDomain.length > 0) {
      // Remove trailing slash if present, then append fileName
      const cleanDomain = publicDomain.replace(/\/$/, '');
      imageUrl = `${cleanDomain}/${fileName}`;
    } else {
      // Fallback to R2 default URL format
      console.warn('⚠️ R2_PUBLIC_DOMAIN not set! Using fallback URL format.');
      const bucketName = process.env.R2_BUCKET_NAME || '';
      const accountId = process.env.R2_ACCOUNT_ID || '';
      imageUrl = `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${fileName}`;
    }

    // Update category image_url in database
    const { error: updateError } = await supabase
      .from('categories')
      .update({ image_url: imageUrl })
      .eq('id', categoryId)
      .eq('company_id', req.companyId);

    if (updateError) {
      console.error('Error updating category image_url:', updateError);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to update category image URL' 
      });
    }

    res.json({ 
      success: true, 
      url: imageUrl,
      fileName: fileName,
    });

  } catch (error: any) {
    console.error('Category Upload Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Upload failed' 
    });
  }
});

/**
 * Upload product image(s) to Cloudflare R2
 * POST /api/uploads/product/:productId
 * Supports single or multiple images
 * Requires authentication and admin role
 */
router.post('/product/:productId', protect, adminOnly, upload.array('images', 10), async (req: MulterRequest, res: Response) => {
  try {
    if (!req.companyId) {
      return res.status(400).json({
        success: false,
        error: 'Company context is required'
      });
    }

    // Handle multer errors (file size, etc.)
    if (req.file === undefined && !req.files) {
      // Check if it's a multer error
      const multerError = (req as any).multerError;
      if (multerError) {
        if (multerError.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ 
            success: false,
            error: 'File too large. Maximum size is 50MB. Please compress the image or use a smaller file.' 
          });
        }
        return res.status(400).json({ 
          success: false,
          error: multerError.message || 'File upload error' 
        });
      }
    }

    const files = req.files as Express.Multer.File[];
    const { productId } = req.params;
    const isPrimary = req.body.isPrimary === 'true' || req.body.isPrimary === true;

    if (!files || files.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'No files uploaded' 
      });
    }

    const uploadedImages = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file type
      if (!isImageFile(file.mimetype)) {
        continue; // Skip invalid files
      }

      // Compress image
      const compressedBuffer = await compressProductImage(file.buffer);

      // Generate unique filename
      const fileExtension = 'jpg';
      const fileName = `products/${productId}-${Date.now()}-${i}.${fileExtension}`;

      // Upload to Cloudflare R2
      const parallelUploads3 = new Upload({
        client: r2Client,
        params: {
          Bucket: process.env.R2_BUCKET_NAME || '',
          Key: fileName,
          Body: compressedBuffer,
          ContentType: 'image/jpeg',
        },
      });

      await parallelUploads3.done();

      // Construct public URL
      // Format: https://pub-{hash}.r2.dev/products/{productId}-{timestamp}-{index}.jpg
      const publicDomain = (process.env.R2_PUBLIC_DOMAIN || '').trim();
      let imageUrl: string;
      
      if (publicDomain && publicDomain.length > 0) {
        // Remove trailing slash if present, then append fileName
        const cleanDomain = publicDomain.replace(/\/$/, '');
        imageUrl = `${cleanDomain}/${fileName}`;
        console.log('Using R2_PUBLIC_DOMAIN:', cleanDomain);
      } else {
        // Fallback to R2 default URL format
        // Note: This should not be used in production - set R2_PUBLIC_DOMAIN instead
        console.warn('⚠️ R2_PUBLIC_DOMAIN not set! Using fallback URL format. Set R2_PUBLIC_DOMAIN=https://pub-ec6380c86f4e4f7289e3c6da1d4aebe6.r2.dev');
        const bucketName = process.env.R2_BUCKET_NAME || '';
        const accountId = process.env.R2_ACCOUNT_ID || '';
        imageUrl = `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${fileName}`;
      }
      
      console.log('Generated image URL:', imageUrl);

      // Save to product_images table
      const { data: imageData, error: insertError } = await supabase
        .from('product_images')
        .insert({
          product_id: productId,
          image_url: imageUrl,
          is_primary: i === 0 && isPrimary,
          display_order: i,
          company_id: req.companyId
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error saving product image:', insertError);
        continue; // Skip this image but continue with others
      }

      uploadedImages.push({
        id: imageData.id,
        url: imageUrl,
        fileName: fileName,
      });
    }

    if (uploadedImages.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'No valid images were uploaded' 
      });
    }

    res.json({ 
      success: true, 
      images: uploadedImages,
      count: uploadedImages.length,
    });

  } catch (error: any) {
    console.error('Product Upload Error:', error);
    
    // Handle specific error types
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ 
        success: false,
        error: 'File too large. Maximum size is 50MB. Please compress the image or use a smaller file.' 
      });
    }
    
    if (error.message?.includes('CORS')) {
      return res.status(403).json({ 
        success: false,
        error: 'CORS error. Please check server configuration.' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: error.message || 'Upload failed. Please try again.' 
    });
  }
});

/**
 * Upload purchase invoice file to Cloudflare R2
 * POST /api/uploads/purchase-invoice
 * Accepts image or PDF
 * Requires authentication
 */
router.post('/purchase-invoice', protect, upload.single('invoiceFile'), async (req: MulterRequest, res: Response) => {
  try {
    const file = req.file;
    const purchaseInvoiceId = req.body.purchaseInvoiceId;

    if (!file) {
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded' 
      });
    }

    if (!req.companyId) {
      return res.status(400).json({
        success: false,
        error: 'Company context is required'
      });
    }

    if (!purchaseInvoiceId) {
      return res.status(400).json({ 
        success: false,
        error: 'Purchase invoice ID is required' 
      });
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid file type. Only images (JPEG, PNG, WebP) and PDFs are allowed.' 
      });
    }

    let fileBuffer = file.buffer;
    let contentType = file.mimetype;

    // Compress image if it's an image file
    if (isImageFile(file.mimetype)) {
      fileBuffer = await compressBillImage(file.buffer);
      contentType = 'image/jpeg'; // After compression, it's JPEG
    }
    // PDFs are not compressed

    // Generate unique filename
    const fileExtension = isPdfFile(file.mimetype) ? 'pdf' : 'jpg';
    const fileName = `purchase_invoices/${purchaseInvoiceId}-${Date.now()}.${fileExtension}`;

    // Upload to Cloudflare R2
    const parallelUploads3 = new Upload({
      client: r2Client,
      params: {
        Bucket: process.env.R2_BUCKET_NAME || '',
        Key: fileName,
        Body: fileBuffer,
        ContentType: contentType,
      },
    });

    await parallelUploads3.done();

    // Construct public URL
    // Format: https://pub-{hash}.r2.dev/{fileName}
    const publicDomain = process.env.R2_PUBLIC_DOMAIN || '';
    let fileUrl: string;
    
    if (publicDomain) {
      // Remove trailing slash if present, then append fileName
      const cleanDomain = publicDomain.replace(/\/$/, '');
      fileUrl = `${cleanDomain}/${fileName}`;
    } else {
      // Fallback to R2 default URL format
      fileUrl = `https://${process.env.R2_BUCKET_NAME}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${fileName}`;
    }

    // Update purchase invoice invoice_file_url in database
    const { error: updateError } = await supabase
      .schema('procurement')
      .from('purchase_invoices')
      .update({ invoice_file_url: fileUrl })
      .eq('id', purchaseInvoiceId)
      .eq('company_id', req.companyId);

    if (updateError) {
      console.error('Error updating purchase invoice file URL:', updateError);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to update purchase invoice file URL' 
      });
    }

    res.json({ 
      success: true, 
      url: fileUrl,
      fileName: fileName,
      fileType: isPdfFile(file.mimetype) ? 'pdf' : 'image',
    });

  } catch (error: any) {
    console.error('Purchase Invoice Upload Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Upload failed' 
    });
  }
});

export default router;
