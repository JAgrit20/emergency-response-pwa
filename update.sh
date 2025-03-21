#!/bin/bash
echo "Updating live PWA files..."
cp -r index.html app.js styles.css manifest.json service-worker.js offline.html mock-api.js images /var/www/emergency-pwa/
sudo find /var/www/emergency-pwa -type d -exec chmod 755 {} \;
sudo find /var/www/emergency-pwa -type f -exec chmod 644 {} \;
sudo nginx -t && sudo systemctl reload nginx
echo "Update complete."
