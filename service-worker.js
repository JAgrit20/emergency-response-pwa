// service-worker.js - Handles caching and offline functionality

const CACHE_NAME = 'emergency-pwa-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/styles.css',
  '/manifest.json',
  '/images/logo512.ico',
  '/images/logo236.ico'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache or network with fallback strategy
self.addEventListener('fetch', event => {
  // Skip CAMARA API requests
  if (event.request.url.includes('/camara/')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(event.request)
          .then(response => {
            // Don't cache API responses that might change frequently
            if (!response.ok || event.request.url.includes('/api/')) {
              return response;
            }
            
            // Clone the response as it can only be consumed once
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
              
            return response;
          })
          .catch(() => {
            // If fetch fails, try to return the offline page
            if (event.request.mode === 'navigate') {
              return caches.match('/offline.html');
            }
            
            // For images, return a fallback
            if (event.request.destination === 'image') {
              return caches.match('/images/offline-image.png');
            }
            
            return new Response('Network error occurred', {
              status: 408,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

// Handle background sync for offline form submissions
self.addEventListener('sync', event => {
  if (event.tag === 'emergency-sms-outbox') {
    event.waitUntil(sendPendingSMS());
  }
});

// Function to process pending SMS messages when back online
async function sendPendingSMS() {
  try {
    const db = await openDatabase();
    const tx = db.transaction('smsOutbox', 'readonly');
    const store = tx.objectStore('smsOutbox');
    const pendingMessages = await store.getAll();
    
    const sendPromises = pendingMessages.map(async message => {
      try {
        const response = await fetch(message.url, {
          method: 'POST',
          headers: message.headers,
          body: message.body,
          credentials: 'same-origin'
        });
        
        if (response.ok) {
          // Remove from outbox if successful
          const deleteTx = db.transaction('smsOutbox', 'readwrite');
          const deleteStore = deleteTx.objectStore('smsOutbox');
          await deleteStore.delete(message.id);
          return deleteTx.complete;
        }
      } catch (error) {
        console.error('Failed to send pending SMS:', error);
      }
    });
    
    return Promise.all(sendPromises);
  } catch (error) {
    console.error('Error processing pending SMS:', error);
  }
}

// Helper function to open IndexedDB
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('emergency-app-db', 1);
    
    request.onupgradeneeded = function(event) {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('smsOutbox')) {
        db.createObjectStore('smsOutbox', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('emergencyData')) {
        db.createObjectStore('emergencyData', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = function(event) {
      resolve(event.target.result);
    };
    
    request.onerror = function(event) {
      reject('IndexedDB error: ' + event.target.errorCode);
    };
  });
}