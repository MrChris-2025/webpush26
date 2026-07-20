const webPush = require('web-push');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: 'Method Not Allowed' }) 
    };
  }

  try {
    const { subscription, payload } = JSON.parse(event.body);

    const publicKey = process.env.VAPID_PUBLIC_KEY || 'BGUzkLiSemAIlhdNCJWDxARVhPDZRfPhZIsyvtoxOQde-1SCPGOGTpP6b9qtyhNS5oIYq2RpDwu538vXCIdZr6o';
    const privateKey = process.env.VAPID_PRIVATE_KEY || 'gSREGrm6ko7nZoHrzQSasRcW--C6NSpoNyB3rMoSsIU';

    webPush.setVapidDetails(
      'mailto:admin@example.com',
      publicKey,
      privateKey
    );

    await webPush.sendNotification(subscription, JSON.stringify(payload));

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Push notification delivered successfully.' })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
