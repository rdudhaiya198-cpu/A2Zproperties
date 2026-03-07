// Firebase Messaging service worker
// Replace the config below with your project's messagingSenderId (and apiKey/appId if required)
// Example: 
// const firebaseConfig = { apiKey: '...', authDomain: '...', projectId: '...', messagingSenderId: '...' };

importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const firebaseConfig = {
  messagingSenderId: 'REPLACE_WITH_MESSAGING_SENDER_ID',
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'Notification';
  const notificationOptions = {
    body: payload.notification?.body || '',
    data: payload.data || {},
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});
