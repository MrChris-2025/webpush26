const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
  // Allow CORS options request from iPad frontend
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: 'Method Not Allowed' }) 
    };
  }

  try {
    const { subscription, action, eventId, sport, league } = JSON.parse(event.body);

    // Explicitly configure Blobs store using context or fallbacks
    const store = getStore({
      name: 'push-subscriptions',
      siteID: process.env.SITE_ID || context?.clientContext?.custom?.site_id,
      token: process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_PURGE_API_TOKEN
    });

    const endpointHash = Buffer.from(subscription.endpoint).toString('base64url');
    const blobKey = `${endpointHash}_${eventId}`;

    if (action === 'subscribe') {
      await store.setJSON(blobKey, {
        subscription,
        eventId,
        sport: sport || 'football',
        league: league || 'nfl',
        lastAwayScore: null,
        lastHomeScore: null,
        updatedAt: new Date().toISOString()
      });
    } else if (action === 'unsubscribe') {
      await store.delete(blobKey);
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: `Successfully ${action}d push alerts.` })
    };
  } catch (error) {
    console.error('Save Subscription Crash:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
