// Try importing each script individually to identify which one fails
try {
  importScripts('src/browser-polyfill.js');
} catch (e) {
  console.error('Failed to import browser-polyfill:', e.name, e.message);
}

try {
  importScripts('src/background/learning-engine.js');
} catch (e) {
  console.error('Failed to import learning-engine:', e.name, e.message);
}

try {
  importScripts('src/background/background.js');
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
}, 25000);
