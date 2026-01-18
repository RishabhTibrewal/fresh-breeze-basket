# Cloudflare R2 Setup Guide

This guide will help you set up Cloudflare R2 for file uploads in the Fresh Breeze Basket application.

## Prerequisites

1. A Cloudflare account
2. R2 bucket created in Cloudflare dashboard
3. R2 API tokens generated

## Step 1: Create R2 Bucket

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2** → **Create bucket**
3. Choose a bucket name (e.g., `fresh-breeze-basket`)
4. Select a location/region
5. Click **Create bucket**

## Step 2: Generate API Tokens

1. In Cloudflare Dashboard, go to **R2** → **Manage R2 API Tokens**
2. Click **Create API token**
3. Set permissions:
   - **Object Read & Write** (for uploads)
   - Select your bucket
4. Copy the following values:
   - **Access Key ID**
   - **Secret Access Key**
   - **Account ID** (found in R2 dashboard URL or account settings)

## Step 3: Set Up Custom Domain (Optional but Recommended)

For public file access, you can set up a custom domain:

1. In your R2 bucket settings, go to **Settings** → **Public Access**
2. Click **Connect Domain**
3. Add your custom domain (e.g., `cdn.yourdomain.com`)
4. Follow DNS configuration instructions
5. Copy the public domain URL

## Step 4: Configure Environment Variables

Add the following variables to your `.env` file in the `backend` directory:

```env
# Cloudflare R2 Configuration
R2_ACCOUNT_ID=your_account_id_here
R2_ACCESS_KEY_ID=your_access_key_id_here
R2_SECRET_ACCESS_KEY=your_secret_access_key_here
R2_BUCKET_NAME=your_bucket_name_here
R2_PUBLIC_DOMAIN=https://cdn.yourdomain.com  # Optional: Custom domain for public access
```

### Example `.env` entries:

```env
R2_ACCOUNT_ID=abc123def456
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=fresh-breeze-basket
R2_PUBLIC_DOMAIN=https://cdn.gofreshco.com
```

## Step 5: API Endpoints

### Upload Bill Image
**POST** `/api/uploads/bill`

**Headers:**
- `Authorization: Bearer <token>` (required)
- `Content-Type: multipart/form-data`

**Body (form-data):**
- `billImage`: File (image or PDF)
- `orderId`: String (order ID)

**Response:**
```json
{
  "success": true,
  "url": "https://cdn.yourdomain.com/bills/order-123-1234567890.jpg",
  "fileName": "bills/order-123-1234567890.jpg"
}
```

### Upload General File
**POST** `/api/uploads/file`

**Headers:**
- `Authorization: Bearer <token>` (required)
- `Content-Type: multipart/form-data`

**Body (form-data):**
- `file`: File (any type)
- `folder`: String (optional, default: "uploads")
- `fileName`: String (optional, auto-generated if not provided)

**Response:**
```json
{
  "success": true,
  "url": "https://cdn.yourdomain.com/uploads/1234567890-abc123.pdf",
  "fileName": "uploads/1234567890-abc123.pdf"
}
```

## File Limits

- Maximum file size: **10MB**
- Allowed file types for bills: JPEG, JPG, PNG, WebP, PDF
- Allowed file types for general uploads: Any

## Security

- All upload endpoints require authentication (`protect` middleware)
- Files are validated for type and size before upload
- Unique filenames prevent overwrites
- Files are stored in organized folders (e.g., `bills/`, `uploads/`)

## Troubleshooting

### Error: "R2 configuration is missing"
- Check that all R2 environment variables are set in `.env`
- Restart the server after adding environment variables

### Error: "Upload failed"
- Verify R2 credentials are correct
- Check bucket name matches `R2_BUCKET_NAME`
- Ensure bucket has public access enabled (if using public URLs)

### Error: "Invalid file type"
- Check that the file type is allowed
- For bills: Only images (JPEG, PNG, WebP) and PDFs
- Verify file extension matches MIME type

### Files not accessible publicly
- Ensure `R2_PUBLIC_DOMAIN` is set correctly
- Verify custom domain is configured in R2 bucket settings
- Check DNS records for custom domain

## Testing

You can test the upload endpoint using curl:

```bash
curl -X POST http://localhost:8080/api/uploads/bill \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "billImage=@/path/to/image.jpg" \
  -F "orderId=order-123"
```

## Frontend Integration Example

```typescript
const uploadBill = async (file: File, orderId: string) => {
  const formData = new FormData();
  formData.append('billImage', file);
  formData.append('orderId', orderId);

  const response = await fetch('/api/uploads/bill', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await response.json();
  return data.url; // Use this URL to save to database
};
```

## Cost Considerations

- Cloudflare R2 offers:
  - **10GB free storage** per month
  - **1M Class A operations** (writes) free per month
  - **10M Class B operations** (reads) free per month
  - No egress fees (unlike S3)

## Support

For issues or questions:
1. Check Cloudflare R2 documentation: https://developers.cloudflare.com/r2/
2. Verify environment variables are correctly set
3. Check server logs for detailed error messages
