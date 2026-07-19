import { getStore } from "https://deno.land/x/netlify_blobs@v2.0.0/mod.ts";

const VAPID_PUBLIC_KEY = 'BGUzkLiSemAIlhdNCJWDxARVhPDZRfPhZIsyvtoxOQde-1SCPGOGTpP6b9qtyhNS5oIYq2RpDwu538vXCIdZr6o';
const VAPID_PRIVATE_KEY = Netlify.env.get("VAPID_PRIVATE_KEY");

// Helper to convert base64 strings to Uint8Arrays
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    return new Uint8Array([...atob(base64)].map(c => c.charCodeAt(0)));
}

// Signs a JSON Web Token manually using native WebCrypto (No Node modules required)
async function generateVapidHeader(endpoint) {
    const url = new URL(endpoint);
    const audience = `${url.protocol}//${url.hostname}`;
    
    const header = { alg: "ES256", typ: "JWT" };
    const payload = {
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 43200, // 12 hours
        sub: "mailto:sports-alerts@example.com"
    };

    const encoder = new TextEncoder();
    const tokenParts = `${btoa(JSON.stringify(header))}.${btoa(JSON.stringify(payload))}`.replace(/=/g, "");

    // Load private VAPID key into browser/edge crypto runtime
    const rawKey = urlBase64ToUint8Array(VAPID_PRIVATE_KEY);
    const cryptoKey = await crypto.subtle.importKey(
        "pkcs8",
        rawKey,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"]
    );

    const signature = await crypto.subtle.sign(
        { name: "ECDSA", hash: { name: "SHA-256" } },
        cryptoKey,
        encoder.encode(tokenParts)
    );

    const b64Sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

    return `vapid t=${tokenParts}.${b64Sig}, k=${VAPID_PUBLIC_KEY}`;
}

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
                const status = event.status.type.detail;
                
                const homeScore = parseInt(home.score) || 0;
                const awayScore = parseInt(away.score) || 0;
                const matchId = event.id;

                if (scoreCache[matchId]) {
                    const old = scoreCache[matchId];
                    if (old.homeScore !== homeScore || old.awayScore !== awayScore) {
                        
                        const notificationPayload = JSON.stringify({
                            title: `⚾ Score Update`,
                            body: `${away.team.shortDisplayName} ${awayScore} - ${homeScore} ${home.team.shortDisplayName} [${status}]`,
                            url: `https://www.espn.com/${league}/game/_/gameId/${matchId}`
                        });

                        for (const key of tokenList.blobs) {
                            const subscription = await tokenStore.getJSON(key.key);
                            if (!subscription) continue;

                            // Generate authorization token Apple accepts
                            const authHeader = await generateVapidHeader(subscription.endpoint);

                            // Execute direct secure transmit to Apple gateways
                            await fetch(subscription.endpoint, {
                                method: 'POST',
                                headers: {
                                    'TTL': '60',
                                    'Authorization': authHeader,
                                    'Content-Type': 'application/json'
                                },
                                body: new TextEncoder().encode(notificationPayload)
                            }).catch(() => {});
                        }
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
