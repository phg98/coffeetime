// public/service-worker.js
self.addEventListener('install', (event) => {
    console.log('Service Worker installed.');
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activated.');
});

self.addEventListener('push', (event) => {
    const data = event.data.json();
    const options = {
        body: data.body,
        icon: '/icon.png',
        badge: '/badge.png'
    };
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(process.env.REACT_APP_URL)
    );
});