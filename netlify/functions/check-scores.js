// netlify/functions/check-scores.js
const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

const dbPath = path.join('/tmp', 'subscriptions.json');
const cachePath = path.join('/tmp', 'score-cache.json');

// Configure Cryptographic VAPID Keys
const VAPID_PUBLIC_KEY = 'BGUzkLiSemAIlhdNCJWDxARVhPDZRfPhZIsyvtoxOQde-1SCPGOGTpP6b9qtyhNS5oIYq2RpDwu538vXCIdZr6o';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY; // Save this securely in your Netlify dashboard environment variables

webpush.setVapidDetails(
    'mailto:your-email@example.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

exports.handler = async () => {
    try {
        // Read registered client devices
        if (!fs.existsSync(dbPath)) return { statusCode: 200, body: 'No devices registered.' };
        const subscriptions = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

        let scoreCache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : {};
        const leagues = ['nfl', 'mlb', 'nba'];
        
        for (const league of leagues) {
            const sport = league === 'mlb' ? 'baseball' : league === 'nba' ? 'basketball' : 'football';
            const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard`);
            const data = await res.json();
            const events = data.events || [];

            for (const event of events) {
                const competition = event.competitions[0];
                const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
                const awayTeam = competition.competitors.find(c => c.homeAway === 'away');
                const status = event.status.type.detail;
                
                const currentHomeScore = parseInt(homeTeam.score) || 0;
                const currentAwayScore = parseInt(awayTeam.score) || 0;
                const matchId = event.id;

                if (scoreCache[matchId]) {
                    const oldData = scoreCache[matchId];
                    // If a live score shift occurs, transmit the push array immediately to Apple
                    if (oldData.homeScore !== currentHomeScore || oldData.awayScore !== currentAwayScore) {
                        const payload = JSON.stringify({
                            title: `Score Update: ${awayTeam.team.shortDisplayName} @ ${homeTeam.team.shortDisplayName}`,
                            body: `${awayTeam.team.shortDisplayName} ${currentAwayScore} - ${currentHomeScore} ${homeTeam.team.shortDisplayName} [${status}]`,
                            url: `https://www.espn.com/${league}/game/_/gameId/${matchId}`
                        });

                        // Broadcast to all registered device profiles asynchronously
                        await Promise.all(subscriptions.map(sub => 
                            webpush.sendNotification(sub, payload).catch(err => {
                                if (err.statusCode === 410) {
                                    // Clean up expired device push tokens gracefully
                                }
                            })
                        ));
                    }
                }
                scoreCache[matchId] = { homeScore: currentHomeScore, awayScore: currentAwayScore };
            }
        }

        fs.writeFileSync(cachePath, JSON.stringify(scoreCache));
        return { statusCode: 200, body: 'Score verification cycle executed successfully.' };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
