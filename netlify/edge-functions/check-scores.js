import { getStore } from "https://deno.land/x/netlify_blobs@v2.0.0/mod.ts";

const VAPID_PUBLIC_KEY = 'BGUzkLiSemAIlhdNCJWDxARVhPDZRfPhZIsyvtoxOQde-1SCPGOGTpP6b9qtyhNS5oIYq2RpDwu538vXCIdZr6o';

// Base64 helper tools for crypto encoding pipelines
function decodeBase64(str) {
    return new Uint8Array([...atob(str.replace(/-/g, "+").replace(/_/g, "/"))].map(c => c.charCodeAt(0)));
}

export default async () => {
    try {
        const tokenStore = getStore("push_tokens");
        const cacheStore = getStore("game_caches");
        
        const tokenList = await tokenStore.list();
        if (tokenList.blobs.length === 0) return new Response("No target devices registered.");

        let scoreCache = await cacheStore.getJSON("global_scores") || {};
        const leagues = ['nfl', 'mlb', 'nba'];

        for (const league of leagues) {
            const sport = league === 'mlb' ? 'baseball' : league === 'nba' ? 'basketball' : 'football';
            const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard`);
            const data = await res.json();
            
            for (const event of data.events || []) {
                const comp = event.competitions[0];
                const home = comp.competitors.find(c => c.homeAway === 'home');
                const away = comp.competitors.find(c => c.homeAway === 'away');
                const status = event.status.type.detail;
                
                const homeScore = parseInt(home.score) || 0;
                const awayScore = parseInt(away.score) || 0;
                const matchId = event.id;

                if (scoreCache[matchId]) {
                    const old = scoreCache[matchId];
                    if (old.homeScore !== homeScore || old.awayScore !== awayScore) {
                        
                        // Construct the alert blueprint data
                        const payload = JSON.stringify({
                            title: `Score Shift: ${away.team.shortDisplayName} @ ${home.team.shortDisplayName}`,
                            body: `${away.team.shortDisplayName} ${awayScore} - ${homeScore} ${home.team.shortDisplayName} [${status}]`,
                            url: `https://www.espn.com/${league}/game/_/gameId/${matchId}`
                        });

                        // Cycle through saved token lists and blast updates straight to Apple's gateways
                        for (const key of tokenList.blobs) {
                            const subscription = await tokenStore.getJSON(key.key);
                            if (!subscription) continue;

                            // Send data directly to Apple's Push endpoints (APNs / FCM handles it from here)
                            await fetch(subscription.endpoint, {
                                method: 'POST',
                                headers: {
                                    'TTL': '60',
                                    'Content-Type': 'application/octet-stream',
                                    'Authorization': `WebPush ${VAPID_PUBLIC_KEY}` 
                                },
                                body: new TextEncoder().encode(payload)
                            }).catch(() => {});
                        }
                    }
                }
                scoreCache[matchId] = { homeScore, awayScore };
            }
        }

        await cacheStore.setJSON("global_scores", scoreCache);
        return new Response("Free tracking evaluation loop completed successfully.");
    } catch (err) {
        return new Response(err.message, { status: 500 });
    }
};
