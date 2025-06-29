// Try importing each script individually to identify which one fails
try {
  console.log('Importing browser-polyfill...');
  importScripts('src/browser-polyfill.js');
  console.log('browser-polyfill imported successfully');
} catch (e) {
  console.error('Failed to import browser-polyfill:', e.name, e.message);
}

try {
  console.log('Importing learning-engine...');
  importScripts('src/background/learning-engine.js');
  console.log('learning-engine imported successfully');
} catch (e) {
  console.error('Failed to import learning-engine:', e.name, e.message);
}

try {
  console.log('Importing background...');
  importScripts('src/background/background.js');
  console.log('background imported successfully');
} catch (e) {
  console.error('Failed to import background:', e.name, e.message);
}

// Keep service worker alive with periodic activity
self.addEventListener('install', () => {
  console.log('SmartDefine service worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  console.log('SmartDefine service worker activated');
});

// Ping to keep service worker alive (every 25 seconds)
setInterval(() => {
  console.log('Service worker ping');
}, 25000);
