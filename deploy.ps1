# Create a deployment package
$deployDir = "deploy"
$files = @(
    "index.html",
    "app.js",
    "styles.css",
    "manifest.json",
    "service-worker.js",
    "offline.html",
    "mock-api.js",
    "images"
)

# Create deploy directory
New-Item -ItemType Directory -Force -Path $deployDir

# Copy files
foreach ($file in $files) {
    Copy-Item $file $deployDir -Recurse -Force
}

# Create version file
Get-Date -Format "yyyy-MM-dd HH:mm:ss" | Out-File "$deployDir/version.txt"

# Create zip archive
Compress-Archive -Path "$deployDir/*" -DestinationPath "emergency-response-pwa.zip" -Force

# Clean up deploy directory
Remove-Item $deployDir -Recurse -Force

Write-Host "Deployment package created: emergency-response-pwa.zip"
