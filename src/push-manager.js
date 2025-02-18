// push-manager.js
export const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const swRegistration = await navigator.serviceWorker.register('public/service-worker.js');
      console.log('Service Worker registered:', swRegistration);

      // 알림 권한 요청
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.error('Notification permission denied');
      }

      return swRegistration;
    } catch (error) {
      console.error('Error during service worker registration:', error);
    }
  } else {
    console.warn('Service Worker is not supported');
  }
};

export const showLocalNotification = (title, body, swRegistration) => {
  const options = {
    body: body,
    icon: '/icon.png',
    badge: '/badge.png'
  };

  swRegistration.showNotification(title, options);
};

// 푸시 알림 테스트 함수 추가
export const sendTestNotification = async () => {
  const swRegistration = await registerServiceWorker();
  if (swRegistration) {
    showLocalNotification('Test Notification', 'This is a test notification!', swRegistration);
  }
};
  