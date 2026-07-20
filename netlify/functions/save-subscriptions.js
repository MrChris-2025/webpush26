const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: 'Method Not Allowed' }) 
    };
  }

  try {
    const { subscription, action, eventId, sport, league } = JSON.parse(event.body);
    const store = getStore('push-subscriptions');

    // Create a unique key per user endpoint + event ID
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
      body: JSON.stringify({ message: `Successfully ${action}d push alerts.` })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
