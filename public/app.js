const VAPID_PUBLIC_KEY = "BGUzkLiSemAIlhdNCJWDxARVhPDZRfPhZIsyvtoxOQde-1SCPGOGTpP6b9qtyhNS5oIYq2RpDwu538vXCIdZr6o";
let isSubscribed = false;
let swRegistration = null;

// Ensure DOM is fully loaded before interacting with elements
window.addEventListener('load', () => {
  const btn = document.getElementById('subscribe-btn');

  if ('serviceWorker' in navigator && 'PushManager' in window) {
    // Attach listener once during setup
    btn.addEventListener('click', handleSubscriptionClick);

    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        swRegistration = reg;
        initializeUI();
      })
      .catch(err => console.error('Service Worker registration failed:', err));
  } else {
    if (btn) btn.textContent = 'Push Notifications Not Supported';
  }
});

async function initializeUI() {
  const btn = document.getElementById('subscribe-btn');

  if (Notification.permission === 'denied') {
    btn.textContent = 'Notifications Blocked';
    btn.setAttribute('disabled', true);
    return;
  }

  btn.removeAttribute('disabled');

  // Check existing push token
  const subscription = await swRegistration.pushManager.getSubscription();
  isSubscribed = !(subscription === null);

  updateButtonState();
}

function updateButtonState() {
  const btn = document.getElementById('subscribe-btn');
  if (isSubscribed) {
    btn.textContent = 'Disable Live Alerts';
    btn.style.backgroundColor = '#cc0000';
    btn.style.color = '#fff';
  } else {
    btn.textContent = 'Enable Live Alerts';
    btn.style.backgroundColor = '#0070f3';
    btn.style.color = '#fff';
  }
}

async function handleSubscriptionClick() {
  const btn = document.getElementById('subscribe-btn');
  btn.setAttribute('disabled', true);

  if (isSubscribed) {
    await unsubscribeUser();
  } else {
    await subscribeUser();
  }

  btn.removeAttribute('disabled');
  updateButtonState();
}

async function subscribeUser() {
  let subscription = null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      alert('Permission was denied. Please clear site permissions to enable.');
      return;
    }

    // Subscribe with push server
    subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    // Save token to backend database
    const response = await fetch('/.netlify/functions/save-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription)
    });

    if (!response.ok) {
      throw new Error('Failed to save subscription on backend');
    }

    isSubscribed = true;
    console.log('User successfully subscribed:', subscription);
  } catch (err) {
    console.error('Failed to subscribe the user: ', err);

    // Rollback browser subscription if backend save failed
    if (subscription) {
      await subscription.unsubscribe();
    }
    isSubscribed = false;
  }
}

async function unsubscribeUser() {
  try {
    const subscription = await swRegistration.pushManager.getSubscription();
    if (subscription) {
      // Unsubscribe from browser/vendor service
      await subscription.unsubscribe();

      // Clean up backend database record
      await fetch('/.netlify/functions/remove-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      });
    }
    isSubscribed = false;
  } catch (err) {
    console.error('Error unsubscribing user:', err);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
