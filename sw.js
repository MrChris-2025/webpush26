const VAPID_PUBLIC_KEY = 'YOUR_PUBLIC_VAPID_KEY_HERE';

// Convert base64 VAPID key to Uint8Array for the browser
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export async function initPushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push notifications not supported on this device.');
        return;
    }

    try {
        // 1. Register the worker file located in your public/root directory
        const registration = await navigator.serviceWorker.register('/sw.js');
        
        // 2. Request user permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // 3. Subscribe to push service
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
        }

        // 4. Send subscription data to your Netlify function to store it
        await fetch('/.netlify/functions/save-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription)
        });

        console.log('Successfully subscribed to Web Push!');
    } catch (err) {
        console.error('Push subscription failed:', err);
    }
}
