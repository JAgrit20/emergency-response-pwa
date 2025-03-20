#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Emergency Response PWA - Ubuntu Deployment Script${NC}\n"

# Install required packages if not present
echo -e "${GREEN}Checking and installing required packages...${NC}"
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx zip unzip

# Create web directory
echo -e "${GREEN}Creating web directory...${NC}"
sudo mkdir -p /var/www/emergency-pwa
sudo chown -R $USER:$USER /var/www/emergency-pwa

# Copy files
echo -e "${GREEN}Copying PWA files...${NC}"
cp -r index.html app.js styles.css manifest.json service-worker.js offline.html mock-api.js images /var/www/emergency-pwa/

# Set proper permissions
echo -e "${GREEN}Setting file permissions...${NC}"
sudo find /var/www/emergency-pwa -type d -exec chmod 755 {} \;
sudo find /var/www/emergency-pwa -type f -exec chmod 644 {} \;

# Create Nginx configuration for the application on port 8080
echo -e "${GREEN}Creating Nginx configuration for the PWA on port 8080...${NC}"
sudo tee /etc/nginx/sites-available/emergency-pwa << 'EOF'
server {
    listen 8080;
    listen [::]:8080;
    server_name emergency.jobmatchify.com localhost;
    root /var/www/emergency-pwa;
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    add_header Content-Security-Policy "default-src 'self'; img-src 'self' https: data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';";

    # PWA specific headers
    add_header Service-Worker-Allowed "/";
    
    location / {
        try_files $uri $uri/ /index.html;
        
        # Enable CORS
        add_header 'Access-Control-Allow-Origin' '*';
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range';
    }

    # Cache control for static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|json)$ {
        expires 1d;
        add_header Cache-Control "public, no-transform";
    }

    # Service worker special handling
    location = /service-worker.js {
        expires off;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Service-Worker-Allowed "/";
    }

    # Error pages
    error_page 404 /offline.html;
    error_page 500 502 503 504 /offline.html;
    location = /offline.html {
        internal;
    }
}
EOF

# Create Nginx proxy configuration for port 80 to forward to the application on port 8080
echo -e "${GREEN}Creating Nginx proxy configuration to forward from port 80 to port 8080...${NC}"
sudo tee /etc/nginx/sites-available/emergency-proxy << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name emergency.jobmatchify.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Pass headers for PWA functionality
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Enable the sites
echo -e "${GREEN}Enabling the sites...${NC}"
sudo ln -sf /etc/nginx/sites-available/emergency-pwa /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/emergency-proxy /etc/nginx/sites-enabled/

# Test Nginx configuration
echo -e "${GREEN}Testing Nginx configuration...${NC}"
sudo nginx -t

# Restart Nginx
echo -e "${GREEN}Restarting Nginx...${NC}"
sudo systemctl restart nginx

echo -e "\n${GREEN}Deployment completed!${NC}"
echo -e "${BLUE}Now your application is:${NC}"
echo "1. Running on port 8080 as configured in your original setup"
echo "2. Accessible via emergency.jobmatchify.com (automatically forwarded from port 80 to 8080)"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Set up SSL for secure access with: sudo certbot --nginx -d emergency.jobmatchify.com"
echo "2. Visit https://emergency.jobmatchify.com to test the PWA after SSL setup"
echo "3. Test offline functionality and PWA installation"