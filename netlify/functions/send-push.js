const webpush = require('web-push');

// Configure keys using the Netlify dashboard variables
webpush.setVapidDetails(
  'mailto:your-email@example.com', 
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { payload, subscriptions } = JSON.parse(event.body);

    // Loop through active device tokens and fire the native banners
    const pushPromises = subscriptions.map(sub => 
      webpush.sendNotification(sub, JSON.stringify(payload))
      .catch(err => console.error("Expired subscription dropped:", err))
    );

    await Promise.all(pushPromises);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
