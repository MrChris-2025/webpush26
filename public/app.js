// Change this line inside app.js
await fetch('/.netlify/functions/save-subscription', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(subscription)
});


const VAPID_PUBLIC_KEY = "BGUzkLiSemAIlhdNCJWDxARVhPDZRfPhZIsyvtoxOQde-1SCPGOGTpP6b9qtyhNS5oIYq2RpDwu538vXCIdZr6o";
let isSubscribed = false;
let swRegistration = null;

// Initialize when application loads
if ('serviceWorker' in navigator && 'PushManager' in window) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        swRegistration = reg;
        initializeUI();
      })
      .catch(err => console.error('Service Worker registration failed:', err));
  });
} else {
  const btn = document.getElementById('subscribe-btn');
  btn.textContent = 'Push Notifications Not Supported';
}

// Check current subscription state and set button text
async function initializeUI() {
  const btn = document.getElementById('subscribe-btn');
  btn.removeAttribute('disabled');
  btn.addEventListener('click', handleSubscriptionClick);

  // Check if browser already has an active subscription token
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

// Router to handle subscribing or unsubscribing
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

// Action: Opt-in to Push Notifications
async function subscribeUser() {
  try {
    // Request permission from browser
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      alert('Permission was denied. Please clear site permissions to enable.');
      return;
    }

    // Generate unique push endpoint from Google/Apple push server
    const subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    // Send the endpoint object to your Netlify serverless database function
    await fetch('/.netlify/functions/save-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription)
    });

    isSubscribed = true;
    console.log('User successfully subscribed:', subscription);
  } catch (err) {
    console.error('Failed to subscribe the user: ', err);
  }
}

// Action: Opt-out / Revoke token
async function unsubscribeUser() {
  try {
    const subscription = await swRegistration.pushManager.getSubscription();
    if (subscription) {
      // Remove registration on vendor side
      await subscription.unsubscribe();
      
      // Notify your database backend to clean up and delete the old subscription string
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

// Helper to convert VAPID key string to Uint8Array required by pushManager
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
