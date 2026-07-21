import { getStore } from '@netlify/blobs';

export default async (req, context) => {
  // Handle CORS preflight from iPad
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { subscription, action, eventId, sport, league } = await req.json();

    // Auto-authenticated store in Netlify v2 functions
    const store = getStore('push-subscriptions');

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
        updatedAt: new Date().toISOString(),
      });
    } else if (action === 'unsubscribe') {
      await store.delete(blobKey);
    }

    return new Response(
      JSON.stringify({ message: `Successfully ${action}d push alerts.` }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};
