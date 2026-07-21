const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: 'Method Not Allowed' }) 
    };
  }

  try {
    const { subscription, action, eventId, sport, league } = JSON.parse(event.body);

    const siteID = process.env.SITE_ID || context?.clientContext?.custom?.site_id;
    const token = process.env.NETLIFY_PURGE_API_TOKEN || process.env.NETLIFY_AUTH_TOKEN;

    const storeOptions = { name: 'push-subscriptions' };
    if (siteID && token) {
      storeOptions.siteID = siteID;
      storeOptions.token = token;
    }

    const store = getStore(storeOptions);

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
