# Nginx Configuration for Multi-Tenant Production Setup

This document provides nginx configuration examples for deploying the Fresh Breeze Basket application in production.

## Architecture Overview

- **Frontend**: `*.gofreshco.com` (e.g., `gulffresh.gofreshco.com`)
- **Backend API**: `rishabh.dtsanskar.tech`

## 1. Frontend Server Configuration (gofreshco.com)

### Main Configuration: `/etc/nginx/sites-available/gofreshco.com`

```nginx
# Redirect www to non-www (optional)
server {
    listen 80;
    listen [::]:80;
    server_name www.gofreshco.com;
    return 301 https://gofreshco.com$request_uri;
}

# Main server block for gofreshco.com and all subdomains
server {
    listen 80;
    listen [::]:80;
    server_name gofreshco.com *.gofreshco.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name gofreshco.com *.gofreshco.com;

    # SSL Configuration (use Let's Encrypt or your SSL certificate)
    ssl_certificate /etc/letsencrypt/live/gofreshco.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gofreshco.com/privkey.pem;
    
    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Root directory for frontend build
    root /var/www/gofreshco.com/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Logging
    access_log /var/log/nginx/gofreshco.com.access.log;
    error_log /var/log/nginx/gofreshco.com.error.log;

    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Health check endpoint (if needed)
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
```

### Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/gofreshco.com /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

## 2. Backend API Server Configuration (rishabh.dtsanskar.tech)

### Main Configuration: `/etc/nginx/sites-available/rishabh.dtsanskar.tech`

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name rishabh.dtsanskar.tech;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name rishabh.dtsanskar.tech;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/rishabh.dtsanskar.tech/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rishabh.dtsanskar.tech/privkey.pem;
    
    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Logging
    access_log /var/log/nginx/rishabh.dtsanskar.tech.access.log;
    error_log /var/log/nginx/rishabh.dtsanskar.tech.error.log;

    # Increase body size for file uploads (50MB)
    client_max_body_size 50M;
    client_body_buffer_size 128k;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # API routes - proxy to Node.js backend
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        
        # Preserve original host and headers for tenant resolution
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        
        # IMPORTANT: Preserve the X-Tenant-Subdomain header from frontend
        proxy_set_header X-Tenant-Subdomain $http_x_tenant_subdomain;
        
        # Preserve Origin header for CORS and tenant resolution fallback
        proxy_set_header Origin $http_origin;
        proxy_set_header Referer $http_referer;
        
        # WebSocket support (if needed)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Buffering settings
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:5000/health;
        proxy_set_header Host $host;
        access_log off;
    }

    # Root endpoint
    location / {
        proxy_pass http://localhost:5000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
```

### Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/rishabh.dtsanskar.tech /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

## 3. Important Headers for Multi-Tenancy

The backend relies on these headers for tenant resolution:

1. **X-Tenant-Subdomain** - Primary method (sent by frontend)
2. **Origin** - Fallback method (extracted from CORS requests)
3. **Referer** - Fallback method (if Origin is missing)
4. **Host** - Last resort fallback

The nginx configuration above preserves all these headers when proxying to the backend.

## 4. CORS Considerations

The backend already handles CORS in the Express app, but nginx can also add CORS headers if needed:

```nginx
# Optional: Add CORS headers at nginx level (backend already handles this)
location /api/ {
    # ... other proxy settings ...
    
    # CORS headers (if not handled by backend)
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization, X-Requested-With, X-Tenant-Subdomain' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    
    # Handle preflight requests
    if ($request_method = 'OPTIONS') {
        return 204;
    }
}
```

**Note**: The backend already handles CORS properly, so you typically don't need this in nginx unless you want an extra layer.

## 5. SSL Certificate Setup (Let's Encrypt)

### For Frontend (gofreshco.com):
```bash
sudo certbot --nginx -d gofreshco.com -d *.gofreshco.com
```

### For Backend (rishabh.dtsanskar.tech):
```bash
sudo certbot --nginx -d rishabh.dtsanskar.tech
```

## 6. Testing the Configuration

### Test nginx configuration:
```bash
sudo nginx -t
```

### Test tenant resolution:
1. Visit `https://gulffresh.gofreshco.com`
2. Open browser DevTools → Network tab
3. Check API requests have `X-Tenant-Subdomain: gulffresh` header
4. Verify backend logs show tenant resolution

### Check headers are preserved:
```bash
curl -H "X-Tenant-Subdomain: gulffresh" \
     -H "Origin: https://gulffresh.gofreshco.com" \
     https://rishabh.dtsanskar.tech/api/health
```

## 7. Common Issues and Solutions

### Issue: X-Tenant-Subdomain header not reaching backend
**Solution**: Ensure nginx config has:
```nginx
proxy_set_header X-Tenant-Subdomain $http_x_tenant_subdomain;
```

### Issue: CORS errors
**Solution**: Backend handles CORS, but verify:
- Backend `CORS_ORIGIN` env var includes `*.gofreshco.com`
- Or backend uses wildcard matching (already implemented)

### Issue: Subdomain not resolving
**Solution**: 
- Check DNS: `dig gulffresh.gofreshco.com`
- Verify wildcard SSL certificate covers `*.gofreshco.com`
- Check nginx server_name includes `*.gofreshco.com`

## 8. Environment Variables for Backend

Make sure your backend `.env` has:
```bash
TENANT_BASE_DOMAIN=gofreshco.com
DEFAULT_COMPANY_SLUG=default
CORS_ORIGIN=https://gulffresh.gofreshco.com,https://www.gofreshco.com
# Or rely on wildcard matching (already implemented)
```

## 9. PM2 Process Manager (Backend)

If using PM2 to run the backend:
```bash
pm2 start backend/src/index.ts --name "fresh-breeze-api" --interpreter ts-node
# Or if compiled:
pm2 start dist/index.js --name "fresh-breeze-api"
```

## Summary

**Key Points:**
1. ✅ Frontend nginx serves React app and handles subdomains
2. ✅ Backend nginx proxies to Node.js and preserves tenant headers
3. ✅ SSL certificates needed for both domains
4. ✅ Headers preserved: `X-Tenant-Subdomain`, `Origin`, `Referer`, `Host`
5. ✅ Backend already handles CORS, no extra nginx CORS needed

The application should work correctly in production with these nginx configurations!
