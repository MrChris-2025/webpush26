import { getStore } from "https://deno.land/x/netlify_blobs@v2.0.0/mod.ts";

export default async (request) => {
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const subscription = await request.json();
        const store = getStore("push_tokens");
        
        // Save the device token using its endpoint string as a unique ID key
        const tokenKey = btoa(subscription.endpoint).replace(/=/g, "");
        await store.setJSON(tokenKey, subscription);

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};
