const { getStore } = require('@netlify/blobs');
const webPush = require('web-push');

exports.handler = async () => {
  try {
    const publicKey = process.env.VAPID_PUBLIC_KEY || 'BGUzkLiSemAIlhdNCJWDxARVhPDZRfPhZIsyvtoxOQde-1SCPGOGTpP6b9qtyhNS5oIYq2RpDwu538vXCIdZr6o';
    const privateKey = process.env.VAPID_PRIVATE_KEY || 'gSREGrm6ko7nZoHrzQSasRcW--C6NSpoNyB3rMoSsIU';

    webPush.setVapidDetails(
      'mailto:admin@example.com',
      publicKey,
      privateKey
    );

    const store = getStore('push-subscriptions');
    const { blobs } = await store.list();

    if (!blobs || blobs.length === 0) {
      return { statusCode: 200, body: 'No active subscriptions to check.' };
    }

    // Group subscriptions by sport and league to minimize ESPN API calls
    const subscriptions = await Promise.all(
      blobs.map(async (b) => ({ key: b.key, data: await store.get(b.key, { type: 'json' }) }))
    );

    const validSubscriptions = subscriptions.filter(item => item.data && item.data.subscription);
    const activeRequests = new Map();

    for (const item of validSubscriptions) {
      const sportLeagueKey = `${item.data.sport || 'football'}/${item.data.league || 'nfl'}`;
      if (!activeRequests.has(sportLeagueKey)) {
        activeRequests.set(sportLeagueKey, []);
      }
      activeRequests.get(sportLeagueKey).push(item);
    }

    // Fetch scores for each active sport/league and notify subscribers
    for (const [sportLeague, items] of activeRequests.entries()) {
      const url = `https://site.api.espn.com/apis/site/v2/sports/${sportLeague}/scoreboard`;
      const res = await fetch(url);
      
      if (!res.ok) continue;
      const data = await res.json();
      const eventsMap = new Map((data.events || []).map(e => [e.id, e]));

      for (const item of items) {
        const event = eventsMap.get(item.data.eventId);
        if (!event) continue;

        const competition = event.competitions[0];
        const home = competition.competitors.find(c => c.homeAway === 'home');
        const away = competition.competitors.find(c => c.homeAway === 'away');

        const currentAwayScore = away.score ?? '-';
        const currentHomeScore = home.score ?? '-';

        // Check if score changed since last background check
        if (
          item.data.lastAwayScore !== null &&
          (item.data.lastAwayScore !== currentAwayScore || item.data.lastHomeScore !== currentHomeScore)
        ) {
          const awayName = away.team.abbreviation || away.team.shortDisplayName;
          const homeName = home.team.abbreviation || home.team.shortDisplayName;
          const statusText = event.status.type.detail;

          const payload = JSON.stringify({
            title: 'Score Update',
            body: `${awayName} ${currentAwayScore} - ${currentHomeScore} ${homeName} (${statusText})`,
            icon: 'https://hcforever.nekoweb.org/mo2.png',
            data: { eventId: event.id }
          });

          try {
            await webPush.sendNotification(item.data.subscription, payload);
          } catch (pushErr) {
            // Clean up expired or revoked subscriptions (410 Gone / 404 Not Found)
            if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
              await store.delete(item.key);
            }
          }
        }

        // Update stored scores for the next background check cycle
        item.data.lastAwayScore = currentAwayScore;
        item.data.lastHomeScore = currentHomeScore;
        await store.setJSON(item.key, item.data);
      }
    }

    return { statusCode: 200, body: 'Completed background score checks and push notifications.' };
  } catch (error) {
    return { statusCode: 500, body: error.message };
  }
};
