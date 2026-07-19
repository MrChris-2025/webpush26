const webpush = require('web-push');

// Configure VAPID details via Netlify Dashboard Environment Variables
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

        // Map over saved subscriptions and send push payloads
        const pushPromises = subscriptions.map(sub => 
            webpush.sendNotification(sub, JSON.stringify(payload))
                .catch(err => {
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        // Clean up expired/unsubscribed tokens from your DB here
                    }
                })
        );

        await Promise.all(pushPromises);

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true })
        };
    } catch (error) {
        return { statusCode: 500, body: error.toString() };
    }
};
