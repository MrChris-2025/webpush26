const webpush = require('web-push');

// Configure your VAPID keys securely inside Netlify UI Environment Variables
webpush.setVapidDetails(
  'mailto:your-email@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

exports.handler = async () => {
  try {
    // 1. Fetch live data from ESPN's public endpoints (e.g., NFL scoreboard)
    const response = await fetch('https://espn.com');
    const data = await response.json();
    
    // 2. Loop through active live games
    const games = data.events || [];
    for (const game of games) {
      const homeTeam = game.competitions[0].competitors[0].team.displayName;
      const homeScore = game.competitions[0].competitors[0].score;
      const awayTeam = game.competitions[0].competitors[1].team.displayName;
      const awayScore = game.competitions[0].competitors[1].score;
      const gameStatus = game.status.type.detail; // e.g., "3rd Quarter"

      // 3. Define alert payload if a score update is detected
      const payload = JSON.stringify({
        title: `Score Alert: ${homeTeam} vs ${awayTeam}`,
        body: `${homeTeam}: ${homeScore} | ${awayTeam}: ${awayScore} (${gameStatus})`,
        gameId: game.id,
        url: `https://espn.com{game.id}`
      });

      // 4. Retrieve saved browser subscriptions from your database
      const activeSubscriptions = []; // Fetch from DB (Supabase/Fauna/MongoDB)

      // 5. Broadcast to users
      await Promise.all(
        activeSubscriptions.map(sub => 
          webpush.sendNotification(sub, payload).catch(err => console.error("Expired subscription token:", err))
        )
      );
    }

    return { statusCode: 200, body: "Scores checked and notifications broadcasted." };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: error.toString() };
  }
};
