// File: app.js - Main application logic

// Initialize the PWA
document.addEventListener('DOMContentLoaded', initApp);

// Configuration
const config = {
  apiEndpoints: {
    deviceLocation: 'https://api.operator.com/camara/device-location/v1',
    deviceStatus: 'https://api.operator.com/camara/device-status/v1',
    qod: 'https://api.operator.com/camara/qod/v1',
    sms: 'https://api.operator.com/camara/sms/v1'
  },
  emergencyBackend: 'https://your-emergency-backend.com/api',
  offlineCacheKey: 'emergency-data-cache'
};

let lastKnownConnectivity = null;
let connectivityCheckCount = 0;
const CHECKS_BEFORE_ONLINE = 3; // Require 3 successful checks before showing online
const CHECK_INTERVAL = 1500; // Check every 1.5 seconds

// Main initialization function
async function initApp() {
  // Initialize UI as offline first
  updateUI('initializing');
  document.addEventListener('DOMContentLoaded', () => {
    const sendSmsBtn = document.getElementById('send-sms-location');
    if (sendSmsBtn) {
      console.log('Send SMS button found. Adding event listener.');
      sendSmsBtn.addEventListener('click', async () => {
        try {
          const location = await getUserLocation();
          const message = `I am here at latitude: ${location.latitude} and longitude: ${location.longitude}`;
          console.log('Prepared message:', message);
          const smsLink = `sms:?body=${encodeURIComponent(message)}`;
          window.location.href = smsLink;
        } catch (error) {
          console.error('Could not get location:', error);
          showErrorMessage('Failed to access location. Please check permissions.');
        }
      });
    } else {
      console.warn('Send SMS button not found in DOM.');
    }
  });
  
  setOfflineMode(true);

  // Set up offline detection
  window.addEventListener('offline', () => {
    console.log('Browser reports offline');
    connectivityCheckCount = 0;
    setOfflineMode(true);
  });

  // Initial network check
  await checkAndUpdateConnectivity();

  // Set up periodic connectivity checks
  setInterval(checkAndUpdateConnectivity, CHECK_INTERVAL);
}



// Function to check connectivity
async function checkConnectivity() {
  try {
    // If browser reports offline, don't even try
    if (!navigator.onLine) {
      return false;
    }

    // Try multiple endpoints in parallel
    const endpoints = [
      'https://www.cloudflare.com/cdn-cgi/trace',  // Cloudflare's trace endpoint
      'https://www.google.com/favicon.ico',         // Google's favicon
      'https://www.microsoft.com/favicon.ico'       // Microsoft's favicon
    ];

    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 10000);

    // Create promises for each endpoint
    const checks = endpoints.map(endpoint => {
      return new Promise(resolve => {
        const img = new Image();
        
        const timeout = setTimeout(() => {
          img.src = '';  // Cancel the request
          resolve(false);
        }, 1500);  // 1.5 second timeout

        img.onload = () => {
          clearTimeout(timeout);
          resolve(true);
        };

        img.onerror = () => {
          clearTimeout(timeout);
          resolve(false);
        };

        // Add cache busting parameters
        img.src = `${endpoint}?t=${timestamp}&r=${randomNum}`;
      });
    });

    // Wait for all checks, consider online if ANY check succeeds
    const results = await Promise.all(checks);
    return results.some(result => result === true);

  } catch (error) {
    console.warn('Connectivity check failed:', error);
    return false;
  }
}

// Function to update UI for offline mode
function setOfflineMode(force = false) {
  if (force || lastKnownConnectivity !== false) {
    console.log('Setting offline mode');
    lastKnownConnectivity = false;
    connectivityCheckCount = 0;
    
    const statusElement = document.getElementById('connection-status');
    const appContainer = document.getElementById('app-container');
    const offlineInstructions = document.getElementById('offline-instructions');
    
    statusElement.textContent = 'Offline Mode';
    statusElement.className = 'status-offline';
    appContainer.className = 'mode-offline';
    offlineInstructions.classList.remove('hidden');
    
    initOfflineMode();
  }
}

// Function to update UI for online mode
function setOnlineMode() {
  if (lastKnownConnectivity !== true) {
    console.log('Setting online mode after', connectivityCheckCount, 'successful checks');
    lastKnownConnectivity = true;
    
    const statusElement = document.getElementById('connection-status');
    const appContainer = document.getElementById('app-container');
    const offlineInstructions = document.getElementById('offline-instructions');
    
    statusElement.textContent = 'Online Mode';
    statusElement.className = 'status-online';
    appContainer.className = 'mode-online';
    offlineInstructions.classList.add('hidden');
    
    initOnlineMode();
  }
}

// Function to check and update connectivity status
async function checkAndUpdateConnectivity() {
  const statusElement = document.getElementById('connection-status');
  
  // Only show checking state during initialization
  if (lastKnownConnectivity === null) {
    statusElement.textContent = 'Checking connection...';
    statusElement.className = 'status-checking';
  }
  
  const isOnline = await checkConnectivity();
  
  if (isOnline) {
    connectivityCheckCount++;
    if (connectivityCheckCount >= CHECKS_BEFORE_ONLINE) {
      setOnlineMode();
    }
  } else {
    setOfflineMode();
  }
  
  return isOnline;
}

// Initialize online mode functionality
async function initOnlineMode() {
  updateUI('online');
  
  try {
    // Request QoD (Quality on Demand) for prioritized network traffic
    await requestQoD();
    
    // Get user location
    const location = await getUserLocation();
    
    // Fetch emergency data based on location
    const emergencyData = await fetchEmergencyData(location);
    
    // Store data in cache for offline use
    await storeDataInCache(emergencyData);
    
    // Display emergency information
    displayEmergencyInfo(emergencyData);
    
    // Set up periodic data refresh
    setUpDataRefresh();
  } catch (error) {
    console.error('Error in online mode:', error);
    showErrorMessage('Failed to fetch emergency data. Please try again.');
  }
}

// Initialize offline mode functionality
async function initOfflineMode() {
  updateUI('offline');
  
  try {
    // Try to use cached data first
    const cachedData = await getCachedData();
    
    if (cachedData) {
      displayEmergencyInfo(cachedData);
    }
    
    // Get user location if possible
    let location;
    try {
      location = await getUserLocation();
    } catch (locError) {
      console.error('Could not get location in offline mode:', locError);
    }
    
    // If we have a phone number and location, send SMS
    const phoneNumber = getUserPhoneNumber();
    if (phoneNumber && location) {
      sendEmergencySMS(phoneNumber, location);
    } else {
      // Prompt user for phone number if not available
      showPhoneNumberInput();
    }
  } catch (error) {
    console.error('Error in offline mode:', error);
    showErrorMessage('Limited functionality in offline mode. Please provide your phone number for SMS updates.');
  }
}

// Request Quality on Demand for prioritized network traffic
async function requestQoD() {
  try {
    const response = await fetch(`${config.apiEndpoints.qod}/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + getAccessToken(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        duration: 3600, // 1 hour in seconds
        qosProfile: 'EMERGENCY',
        webhookUrl: `${config.emergencyBackend}/qod-callback`
      })
    });
    
    if (!response.ok) throw new Error('QoD API response was not ok');
    const data = await response.json();
    console.log('QoD session established:', data);
    return data.sessionId;
  } catch (error) {
    console.error('Error requesting QoD:', error);
    // Continue without QoD
    return null;
  }
}

// Fetch emergency data from backend
async function fetchEmergencyData(location) {
  const response = await fetch(`${config.emergencyBackend}/emergency-data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy
    })
  });
  
  if (!response.ok) throw new Error('Emergency backend response was not ok');
  return await response.json();
}

// Send emergency SMS using CAMARA SMS API
async function sendEmergencySMS(phoneNumber, location) {
  try {
    // Get cached emergency data if available
    const cachedData = await getCachedData();
    let messageContent = 'EMERGENCY ALERT: ';
    
    if (cachedData) {
      // Format SMS with available emergency data
      messageContent += `Nearest shelter: ${cachedData.shelters[0].name}, ${cachedData.shelters[0].distance}km away. `;
      messageContent += `Evacuation route: ${cachedData.evacuationRoutes[0].description}. `;
      messageContent += `Nearest gas station: ${cachedData.gasStations[0].name}, ${cachedData.gasStations[0].distance}km away.`;
    } else {
      // Generic message if no data available
      messageContent += 'No internet connection detected. Emergency services have been notified of your location. Stay in a safe place.';
    }
    
    const response = await fetch(`${config.apiEndpoints.sms}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + getAccessToken(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phoneNumber: phoneNumber,
        message: messageContent,
        callbackUrl: `${config.emergencyBackend}/sms-callback`
      })
    });
    
    if (!response.ok) throw new Error('SMS API response was not ok');
    const data = await response.json();
    console.log('SMS sent successfully:', data);
    
    showMessage('Emergency information has been sent to your phone.');
    return data.messageId;
  } catch (error) {
    console.error('Error sending SMS:', error);
    showErrorMessage('Failed to send SMS. Please try again or call emergency services directly.');
    return null;
  }
}

// Get user location using CAMARA Device Location API
async function getUserLocation() {
  // First try the CAMARA API
  try {
    const response = await fetch(`${config.apiEndpoints.deviceLocation}/location`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + getAccessToken(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accuracy: 'HIGH'
      })
    });
    
    if (!response.ok) throw new Error('Location API response was not ok');
    const data = await response.json();
    return {
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.accuracy
    };
  } catch (error) {
    console.error('Error getting location from CAMARA API:', error);
    
    // Fallback to browser geolocation API
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });
      
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      };
    } catch (geoError) {
      console.error('Browser geolocation failed:', geoError);
      throw new Error('Could not retrieve location');
    }
  }
}

// Cache data for offline use
async function storeDataInCache(data) {
  if ('caches' in window) {
    const cache = await caches.open('emergency-data-cache');
    
    // Store API response in IndexedDB
    const db = await openDatabase();
    const tx = db.transaction('emergencyData', 'readwrite');
    const store = tx.objectStore('emergencyData');
    store.put({
      id: 'latest',
      data: data,
      timestamp: Date.now()
    });
    
    return tx.complete;
  } else {
    // Fallback to localStorage if caches API not available
    localStorage.setItem(config.offlineCacheKey, JSON.stringify({
      data: data,
      timestamp: Date.now()
    }));
  }
}

// Get cached data
async function getCachedData() {
  if ('caches' in window) {
    try {
      const db = await openDatabase();
      const tx = db.transaction('emergencyData', 'readonly');
      const store = tx.objectStore('emergencyData');
      const cachedData = await store.get('latest');
      
      if (cachedData && cachedData.data) {
        return cachedData.data;
      }
    } catch (error) {
      console.error('Error getting data from IndexedDB:', error);
    }
  }
  
  // Fallback to localStorage
  const storedData = localStorage.getItem(config.offlineCacheKey);
  if (storedData) {
    try {
      const parsedData = JSON.parse(storedData);
      return parsedData.data;
    } catch (error) {
      console.error('Error parsing stored data:', error);
    }
  }
  
  return null;
}

// Open IndexedDB
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('emergency-app-db', 1);
    
    request.onupgradeneeded = function(event) {
      const db = event.target.result;
      db.createObjectStore('emergencyData', { keyPath: 'id' });
    };
    
    request.onsuccess = function(event) {
      resolve(event.target.result);
    };
    
    request.onerror = function(event) {
      reject('IndexedDB error: ' + event.target.errorCode);
    };
  });
}

// Get access token - this would be implemented based on your auth system
function getAccessToken() {
  // In a real app, implement proper auth flow
  // This is just a placeholder
  return localStorage.getItem('auth_token') || 'default-token';
}

// Helper functions for UI updates
function updateUI(mode) {
  const appContainer = document.getElementById('app-container');
  appContainer.className = `mode-${mode}`;
  
  const statusElement = document.getElementById('connection-status');
  
  switch (mode) {
    case 'initializing':
      statusElement.textContent = 'Initializing app...';
      statusElement.className = 'status-initializing';
      break;
    case 'online':
      statusElement.textContent = 'Online Mode';
      statusElement.className = 'status-online';
      break;
    case 'offline':
      statusElement.textContent = 'Offline Mode';
      statusElement.className = 'status-offline';
      break;
  }
}

function displayEmergencyInfo(data) {
  const infoContainer = document.getElementById('emergency-info');
  infoContainer.innerHTML = ''; // Clear previous content
  
  // Create and append shelter information
  const sheltersSection = document.createElement('div');
  sheltersSection.className = 'info-section';
  sheltersSection.innerHTML = `
    <h2>Nearby Shelters</h2>
    <ul>
      ${data.shelters.map(shelter => `
        <li>
          <strong>${shelter.name}</strong> (${shelter.distance}km)
          <p>${shelter.address}</p>
          <p>Capacity: ${shelter.capacity}</p>
        </li>
      `).join('')}
    </ul>
  `;
  
  // Create and append evacuation routes
  const routesSection = document.createElement('div');
  routesSection.className = 'info-section';
  routesSection.innerHTML = `
    <h2>Evacuation Routes</h2>
    <ul>
      ${data.evacuationRoutes.map(route => `
        <li>
          <strong>${route.name}</strong>
          <p>${route.description}</p>
        </li>
      `).join('')}
    </ul>
  `;
  
  // Create and append gas stations
  const gasSection = document.createElement('div');
  gasSection.className = 'info-section';
  gasSection.innerHTML = `
    <h2>Fuel Stations</h2>
    <ul>
      ${data.gasStations.map(station => `
        <li>
          <strong>${station.name}</strong> (${station.distance}km)
          <p>${station.address}</p>
          <p>Fuel available: ${station.fuelAvailable ? 'Yes' : 'No'}</p>
        </li>
      `).join('')}
    </ul>
  `;
  
  infoContainer.appendChild(sheltersSection);
  infoContainer.appendChild(routesSection);
  infoContainer.appendChild(gasSection);
}

function showMessage(message) {
  const messageElement = document.getElementById('message');
  messageElement.textContent = message;
  messageElement.className = 'message visible';
  
  setTimeout(() => {
    messageElement.className = 'message';
  }, 5000);
}

function showErrorMessage(message) {
  const messageElement = document.getElementById('message');
  messageElement.textContent = message;
  messageElement.className = 'message error visible';
  
  setTimeout(() => {
    messageElement.className = 'message';
  }, 5000);
}

function setUpDataRefresh() {
  // Refresh emergency data every 5 minutes
  setInterval(async () => {
    try {
      if (navigator.onLine) {
        const location = await getUserLocation();
        const emergencyData = await fetchEmergencyData(location);
        await storeDataInCache(emergencyData);
        displayEmergencyInfo(emergencyData);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  }, 5 * 60 * 1000);
}

function getUserPhoneNumber() {
  return localStorage.getItem('user_phone_number');
}

function showPhoneNumberInput() {
  const phoneInputContainer = document.getElementById('phone-input-container');
  phoneInputContainer.className = 'visible';
  
  document.getElementById('phone-submit').addEventListener('click', () => {
    const phoneNumber = document.getElementById('phone-number').value;
    if (phoneNumber && phoneNumber.length >= 10) {
      localStorage.setItem('user_phone_number', phoneNumber);
      phoneInputContainer.className = '';
      
      // Try to send SMS with the provided number
      getUserLocation()
        .then(location => sendEmergencySMS(phoneNumber, location))
        .catch(error => console.error('Error sending SMS after phone input:', error));
    } else {
      showErrorMessage('Please enter a valid phone number');
    }
  });
}

// PWA installation handling
// Ensure this is declared in the global scope 
let deferredPrompt;
console.log('deferredPrompt variable initialized');
// const installButton = document.getElementById('install-button');
const installButton = document.getElementById('install-button');
// Add this logging
console.log('Setting up beforeinstallprompt listener');

window.addEventListener('beforeinstallprompt', (e) => {
    console.log('beforeinstallprompt event fired');
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    
    // Stash the event so it can be triggered later
    deferredPrompt = e;
    
    // Show the install button
    if (installButton) {
        console.log('Showing install button');
        installButton.classList.remove('hidden');
    } else {
        console.log('Install button not found');
    }
});
console.log('Install button found:', installButton);

if (installButton) {
  console.log('Adding click listener to install button');
  installButton.addEventListener('click', async () => {
    console.log('Install button clicked');
    if (!deferredPrompt) {
      console.log('No deferred prompt available');
      return;
    }
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    
    // Clear the deferredPrompt variable
    deferredPrompt = null;
    
    // Hide the install button
    installButton.classList.add('hidden');
  });
}

// Hide button if app is already installed
window.addEventListener('appinstalled', () => {
    installButton.classList.add('hidden');
    console.log('PWA was installed');
});