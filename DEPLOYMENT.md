# Deployment Guide for Emergency Response PWA

## Prerequisites
- A web server with HTTPS support (required for PWAs)
- Access to your server's configuration
- Node.js and npm (if using the provided development server)

## Deployment Steps

### 1. Package Your Files
Run the provided deployment script to create a deployment package:
```powershell
.\deploy.ps1
```
This will create `emergency-response-pwa.zip` containing all necessary files.

### 2. Server Requirements
Your web server must:
- Support HTTPS (required for PWAs)
- Set proper MIME types for:
  - `.js` files: `application/javascript`
  - `.json` files: `application/json`
  - `.css` files: `text/css`
  - `.ico` files: `image/x-icon`
  - `.png` files: `image/png`

### 3. Server Configuration

#### Apache
Add to `.htaccess`:
```apache
# Enable CORS
Header set Access-Control-Allow-Origin "*"

# Proper MIME types
AddType application/javascript .js
AddType application/json .json
AddType text/css .css
AddType image/x-icon .ico

# Cache control for PWA assets
<FilesMatch ".(ico|json|js|css|png)$">
    Header set Cache-Control "max-age=86400, public"
</FilesMatch>

# Service Worker scope
<Files "service-worker.js">
    Header set Service-Worker-Allowed "/"
</Files>
```

#### Nginx
Add to your server block:
```nginx
location / {
    add_header Access-Control-Allow-Origin *;
    add_header Service-Worker-Allowed /;
    
    # Proper MIME types
    types {
        application/javascript js;
        application/json json;
        text/css css;
        image/x-icon ico;
        image/png png;
    }
    
    # Cache control
    location ~* \.(ico|json|js|css|png)$ {
        expires 1d;
        add_header Cache-Control "public, no-transform";
    }
}
```

### 4. Deployment Steps

1. Upload files to your server:
   ```bash
   # Using FTP
   ftp your-server.com
   put emergency-response-pwa.zip

   # Or using SCP
   scp emergency-response-pwa.zip user@your-server.com:/path/to/web/root
   ```

2. Extract files on server:
   ```bash
   unzip emergency-response-pwa.zip
   ```

3. Set proper permissions:
   ```bash
   chmod -R 755 .
   chmod 644 *.html *.js *.css *.json
   ```

### 5. Testing Deployment

1. Visit your site using HTTPS
2. Verify the following work:
   - App loads correctly
   - "Add to Home Screen" prompt appears
   - Offline functionality works
   - Network detection works properly
   - All images and icons load
   - Service worker registers successfully

### 6. Troubleshooting

Check browser's Developer Tools:
1. Application tab > Service Workers
2. Console for any errors
3. Network tab for failed requests
4. Application > Cache Storage for cached assets

Common issues:
- HTTPS not configured correctly
- MIME types not set properly
- Service worker scope issues
- CORS errors
- Incorrect file permissions

### 7. Production Considerations

1. Enable GZIP compression
2. Set up proper SSL certificates
3. Configure proper cache headers
4. Set up monitoring
5. Configure proper CORS headers if needed
6. Set up automated deployments

## Support

If you encounter issues:
1. Check server logs
2. Verify HTTPS configuration
3. Test offline functionality
4. Validate manifest.json
5. Check service worker registration
