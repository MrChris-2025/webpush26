// Change this line inside app.js
await fetch('/.netlify/functions/save-subscription', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(subscription)
});
