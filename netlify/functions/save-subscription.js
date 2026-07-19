// netlify/functions/save-subscription.js
const fs = require('fs');
const path = require('path');

// Basic persistence mechanism (for local/serverless write handling)
const dbPath = path.join('/tmp', 'subscriptions.json');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const subscription = JSON.parse(event.body);
        let subscriptions = [];

        if (fs.existsSync(dbPath)) {
            subscriptions = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        }

        // Avoid adding duplicate registration endpoints
        const exists = subscriptions.some(sub => sub.endpoint === subscription.endpoint);
        if (!exists) {
            subscriptions.push(subscription);
            fs.writeFileSync(dbPath, JSON.stringify(subscriptions));
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true, message: 'Device securely registered.' })
        };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
