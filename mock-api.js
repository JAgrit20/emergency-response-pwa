// Add this to your project for development testing

// Simulated CAMARA API responses
const mockResponses = {
    deviceLocation: {
      latitude: 37.7749,
      longitude: -122.4194,
      accuracy: 10
    },
    deviceStatus: {
      connectivity: 'CONNECTED'
    },
    qod: {
      sessionId: 'mock-session-123'
    },
    sms: {
      messageId: 'mock-sms-123'
    }
  };
  
  // Mock emergency data
  const mockEmergencyData = {
    shelters: [
      {
        name: "Central Community Center",
        distance: 1.2,
        address: "123 Main St, City",
        capacity: "350 people"
      },
      {
        name: "North High School",
        distance: 2.5,
        address: "456 North Ave, City",
        capacity: "500 people"
      }
    ],
    evacuationRoutes: [
      {
        name: "Route A",
        description: "Head north on Main St, then east on Broadway to highway 101"
      },
      {
        name: "Route B",
        description: "Head south on Market St to the bridge, then follow signs to evacuation center"
      }
    ],
    gasStations: [
      {
        name: "QuickFuel Station",
        distance: 0.8,
        address: "789 Gas St, City",
        fuelAvailable: true
      },
      {
        name: "EnergyPlus Gas",
        distance: 1.5,
        address: "321 Fuel Ave, City",
        fuelAvailable: false
      }
    ]
  };
  
  // Before your app.js loads, intercept fetch requests to CAMARA endpoints
  const originalFetch = window.fetch;
  window.fetch = function(url, options) {
    console.log('Intercepted fetch to:', url);
    
    // Mock CAMARA device location API
    if (url.includes('/device-location/') && options.method === 'POST') {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(new Response(JSON.stringify(mockResponses.deviceLocation), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }));
        }, 500); // Simulate network delay
      });
    }
    
    // Mock CAMARA device status API
    if (url.includes('/device-status/') && options.method === 'GET') {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(new Response(JSON.stringify(mockResponses.deviceStatus), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }));
        }, 300);
      });
    }
    
    // Mock CAMARA QoD API
    if (url.includes('/qod/sessions') && options.method === 'POST') {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(new Response(JSON.stringify(mockResponses.qod), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }));
        }, 400);
      });
    }
    
    // Mock CAMARA SMS API
    if (url.includes('/sms/messages') && options.method === 'POST') {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(new Response(JSON.stringify(mockResponses.sms), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }));
        }, 600);
      });
    }
    
    // Mock emergency backend API
    if (url.includes('/emergency-data') && options.method === 'POST') {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(new Response(JSON.stringify(mockEmergencyData), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }));
        }, 800);
      });
    }
    
    // For all other requests, use the original fetch
    return originalFetch(url, options);
  };
  
  console.log('Mock API interceptor initialized');