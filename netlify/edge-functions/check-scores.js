import { getStore } from "https://deno.land/x/netlify_blobs@v2.0.0/mod.ts";

const VAPID_PUBLIC_KEY = 'BGUzkLiSemAIlhdNCJWDxARVhPDZRfPhZIsyvtoxOQde-1SCPGOGTpP6b9qtyhNS5oIYq2RpDwu538vXCIdZr6o';
const VAPID_PRIVATE_KEY = Netlify.env.get("VAPID_PRIVATE_KEY");

export default async () => {
    try {
        const tokenStore = getStore("push_tokens");
        const cacheStore = getStore("game_caches");
        
        const tokenList = await tokenStore.list();
        if (tokenList.blobs.length === 0) return new Response("No target devices.");

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
                
                const homeScore = parseInt(home.score) || 0;
                const awayScore = parseInt(away.score) || 0;
                const matchId = event.id;

                if (scoreCache[matchId]) {
                    const old = scoreCache[matchId];
                    if (old.homeScore !== homeScore || old.awayScore !== awayScore) {
                        // A live delta change occurred! Compile web-push notification arrays here
                        console.log(`Score Shift Detected: ${event.name}`);
                    }
                }
                scoreCache[matchId] = { homeScore, awayScore };
            }
        }

        await cacheStore.setJSON("global_scores", scoreCache);
        return new Response("Sync completed safely.");
    } catch (err) {
        return new Response(err.message, { status: 500 });
    }
};
